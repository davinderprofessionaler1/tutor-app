import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export type AdminProfile = { firstName: string; lastName: string; email: string; phone: string; jobTitle: string; role: string };
export type GeneralSettings = {
  siteName: string; appName: string; companyName: string; websiteUrl: string; supportEmail: string; supportPhone: string;
  businessAddress: string; linkedin: string; youtube: string; instagram: string; twitter: string; logoUrl: string;
};
export type SmtpSettings = {
  host: string; port: number; secure: boolean; username: string; password: string; fromName: string; fromEmail: string;
};
export type CourseChapter = { id: string; title: string; videoIds: string[] };
export type CourseAttachment = { id: string; name: string; url: string; sizeBytes: number; mimeType: string };
export type CourseReview = { id: string; courseId: string; studentId: string; studentName: string; rating: number; comment: string; status: "Pending" | "Approved" | "Rejected"; submittedAt: string; moderatedAt: string; updatedAt: string };
export type SecurityEvent = { id: string; studentId: string; studentName: string; studentEmail: string; eventType: "screenshot" | "screen_recording"; videoTitle: string; detectedAt: string; read: boolean };
export type VideoProgress = { id: string; studentId: string; videoId: string; positionSeconds: number; durationSeconds: number; completed: boolean; reportedAt: number; updatedAt: string };
export type SupportQueryRecord = { id: string; referenceNumber: string; studentId: string; studentName: string; studentEmail: string; subject: string; message: string; status: "Open" | "In Progress" | "Resolved"; adminReply: string; createdAt: string; updatedAt: string };
export type CategoryRecord = { id: string; name: string; slug: string; description: string; active: boolean; updatedAt: string };
export type CourseRecord = { id: string; title: string; category: string; categoryId: string; thumbnailUrl: string; attachments: CourseAttachment[]; chapters: CourseChapter[]; status: string; price: number; salePrice: number; lessons: number; students: number; featured: boolean; updatedAt: string };
export type VideoRecord = { id: string; title: string; course: string; provider: string; sourceUrl: string; durationMinutes: number; status: string; downloadReady: boolean; updatedAt: string };
export type StudentRecord = { id: string; firstName: string; lastName: string; email: string; phone: string; status: "Active" | "Blocked"; courseIds: string[]; joinedAt: string; updatedAt: string };
export type CouponRecord = { id: string; code: string; description: string; discountType: string; discountValue: number; minimumOrder: number; usageLimit: number; used: number; endsAt: string; active: boolean; updatedAt: string };
export type TemplateRecord = { id: string; key: string; name: string; channel: string; subject: string; body: string; enabled: boolean; updatedAt: string };
export type OrderStatus = "Pending" | "Paid" | "Failed" | "Refunded" | "Cancelled";
export type OrderRecord = {
  id: string; orderNumber: string; studentId: string; courseId: string; couponCode: string; subtotal: number; discountAmount: number;
  totalAmount: number; currency: string; status: OrderStatus; paymentProvider: string; paymentReference: string; enrollmentStatus: "Pending" | "Active" | "Revoked" | "Not created";
  enrollmentCreated: boolean; couponUsageRecorded: boolean; createdAt: string; paidAt: string; refundedAt: string; updatedAt: string;
};
export type AdminStore = {
  profile: AdminProfile; passwordHash: string; sessionVersion: number; studentSessionSecret: string; settings: GeneralSettings; smtp: SmtpSettings; updatedAt: string;
  categories: CategoryRecord[]; courses: CourseRecord[]; videos: VideoRecord[]; students: StudentRecord[]; reviews: CourseReview[]; securityEvents: SecurityEvent[]; videoProgress: VideoProgress[]; supportQueries: SupportQueryRecord[]; coupons: CouponRecord[]; templates: TemplateRecord[]; orders: OrderRecord[];
};

const packageRoot = process.cwd().replaceAll("\\", "/").endsWith("/apps/admin") ? process.cwd() : path.join(process.cwd(), "apps", "admin");
const storePath = path.join(packageRoot, "data", "admin-store.json");

function defaultSmtpSettings(): SmtpSettings {
  const from = process.env.SMTP_FROM ?? "Northstar Learning <hello@northstar.test>";
  return {
    host: process.env.SMTP_HOST ?? "127.0.0.1",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
    username: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    fromName: from.match(/^\s*([^<]+?)\s*</)?.[1]?.trim() ?? "Northstar Learning",
    fromEmail: from.match(/<([^>]+)>/)?.[1] ?? from,
  };
}

function defaultResources() {
  const updatedAt = new Date().toISOString();
  const youtubeCatalog = [
    ["html-css", "HTML & CSS Foundations", "Web Development", "pQN-pnXPaVg", 122],
    ["modern-css", "Modern CSS Masterclass", "Web Development", "1Rs2ND1ryYc", 360],
    ["javascript", "JavaScript Essentials", "Programming", "PkZNo7MFNFg", 205],
    ["react", "React Application Development", "Web Development", "bMknfKXIFA8", 720],
    ["python", "Python for Beginners", "Programming", "rfscVS0vtbw", 266],
    ["node", "Node.js and Express", "Web Development", "Oe421EPjeBE", 480],
    ["typescript", "TypeScript Fundamentals", "Programming", "BwuLxPH8IDs", 272],
    ["git", "Git and GitHub Workflow", "Developer Tools", "RGOj5yH7evk", 68],
    ["sql", "SQL and Database Design", "Data", "HXV3zeQKqGY", 247],
    ["docker", "Docker for Developers", "DevOps", "fqMOX6JJhGo", 144],
    ["kubernetes", "Kubernetes Fundamentals", "DevOps", "X48VuDVv0do", 238],
    ["aws", "AWS Cloud Foundations", "Cloud", "ulprqHHWlng", 630],
    ["linux", "Linux Command Line", "Developer Tools", "sWbUDq4S6Y8", 300],
    ["networking", "Computer Networking Basics", "IT & Networking", "qiQR5rTSshw", 550],
    ["algorithms", "Data Structures and Algorithms", "Programming", "RBSGKlAvoiM", 480],
    ["machine-learning", "Machine Learning Foundations", "Data", "Gv9_4yMHFhI", 600],
    ["django", "Django Web Development", "Web Development", "F5mRW0jo-U4", 240],
    ["csharp", "C# Fundamentals", "Programming", "GhQdlIFylQ8", 270],
    ["java", "Java Programming", "Programming", "A74TOX803D0", 720],
    ["golang", "Go Programming", "Programming", "un6ZyFkqFKo", 420],
  ] as const;
  const catalogCategories = [
    ["category-web-development", "Web Development", "web-development"], ["category-programming", "Programming", "programming"],
    ["category-developer-tools", "Developer Tools", "developer-tools"], ["category-data", "Data", "data"],
    ["category-devops", "DevOps", "devops"], ["category-cloud", "Cloud", "cloud"], ["category-networking", "IT & Networking", "it-networking"],
  ] as const;
  const youtubeVideos: VideoRecord[] = youtubeCatalog.map(([key, title, , youtubeId, duration]) => ({
    id: `video-youtube-${key}`, title: `${title} · Full course`, course: title, provider: "YouTube",
    sourceUrl: `https://www.youtube.com/watch?v=${youtubeId}`, durationMinutes: duration, status: "Ready", downloadReady: false, updatedAt,
  }));
  const youtubeCourses: CourseRecord[] = youtubeCatalog.map(([key, title, category, youtubeId], index) => ({
    id: `course-youtube-${key}`, title, category, categoryId: `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`, attachments: [], chapters: [{ id: `chapter-${key}-1`, title: "Chapter 1 · Full course", videoIds: [`video-youtube-${key}`] }],
    status: "Published", price: 1999 + (index % 5) * 500, salePrice: 999 + (index % 4) * 250, lessons: 1, students: 0, featured: index < 4, updatedAt,
  }));
  return {
    categories: [
      { id: "category-product", name: "Product", slug: "product", description: "Product strategy and discovery courses", active: true, updatedAt },
      { id: "category-leadership", name: "Leadership", slug: "leadership", description: "Team and leadership development", active: true, updatedAt },
      { id: "category-communication", name: "Communication", slug: "communication", description: "Presentation and communication skills", active: true, updatedAt },
      ...catalogCategories.map(([id, name, slug]) => ({ id, name, slug, description: `${name} courses and practical tutorials`, active: true, updatedAt })),
    ] satisfies CategoryRecord[],
    courses: [
      { id: "course-product-thinking", title: "Product Thinking Foundations", category: "Product", categoryId: "category-product", thumbnailUrl: "", attachments: [], chapters: [{ id: "chapter-product-1", title: "Chapter 1 · Foundations", videoIds: ["video-welcome"] }, { id: "chapter-product-2", title: "Chapter 2 · Customer research", videoIds: ["video-research"] }], status: "Published", price: 9999, salePrice: 7999, lessons: 24, students: 1240, featured: true, updatedAt },
      { id: "course-leading-teams", title: "Leading Small Teams", category: "Leadership", categoryId: "category-leadership", thumbnailUrl: "", attachments: [], chapters: [], status: "Published", price: 7999, salePrice: 6499, lessons: 18, students: 920, featured: false, updatedAt },
      { id: "course-storytelling", title: "Storytelling for Presentations", category: "Communication", categoryId: "category-communication", thumbnailUrl: "", attachments: [], chapters: [], status: "Draft", price: 5999, salePrice: 4999, lessons: 16, students: 0, featured: false, updatedAt },
      ...youtubeCourses,
    ] satisfies CourseRecord[],
    videos: [
      { id: "video-welcome", title: "Welcome and course map", course: "Product Thinking Foundations", provider: "Vimeo", sourceUrl: "https://vimeo.com/", durationMinutes: 8, status: "Ready", downloadReady: false, updatedAt },
      { id: "video-research", title: "Research interview walkthrough", course: "Product Thinking Foundations", provider: "YouTube", sourceUrl: "https://youtube.com/", durationMinutes: 22, status: "Processing", downloadReady: false, updatedAt },
      ...youtubeVideos,
    ] satisfies VideoRecord[],
    students: [
      { id: "student-mira", firstName: "Mira", lastName: "Shah", email: "mira.shah@example.com", phone: "+91 98765 10001", status: "Active", courseIds: ["course-youtube-html-css", "course-youtube-javascript"], joinedAt: "2026-09-08", updatedAt },
      { id: "student-rohan", firstName: "Rohan", lastName: "Kapoor", email: "rohan.kapoor@example.com", phone: "+91 98765 10002", status: "Active", courseIds: ["course-youtube-python"], joinedAt: "2026-09-12", updatedAt },
      { id: "student-ananya", firstName: "Ananya", lastName: "Pillai", email: "ananya.pillai@example.com", phone: "+91 98765 10003", status: "Active", courseIds: ["course-youtube-react", "course-youtube-typescript"], joinedAt: "2026-09-19", updatedAt },
      { id: "student-dev", firstName: "Dev", lastName: "Malhotra", email: "dev.malhotra@example.com", phone: "+91 98765 10004", status: "Blocked", courseIds: ["course-youtube-docker"], joinedAt: "2026-09-22", updatedAt },
    ] satisfies StudentRecord[],
    reviews: [] satisfies CourseReview[],
    securityEvents: [] satisfies SecurityEvent[],
    videoProgress: [] satisfies VideoProgress[],
    supportQueries: [] satisfies SupportQueryRecord[],
    coupons: [
      { id: "coupon-welcome20", code: "WELCOME20", description: "New student launch offer", discountType: "Percentage", discountValue: 20, minimumOrder: 4999, usageLimit: 250, used: 84, endsAt: "2026-12-31", active: true, updatedAt },
      { id: "coupon-team1000", code: "TEAM1000", description: "Leadership course promotion", discountType: "Fixed", discountValue: 1000, minimumOrder: 7000, usageLimit: 100, used: 31, endsAt: "2026-11-30", active: true, updatedAt },
    ] satisfies CouponRecord[],
    templates: [
      { id: "template-welcome", key: "student_welcome", name: "Student welcome", channel: "Email", subject: "Welcome to {{app_name}}", body: "Hi {{first_name}}, welcome to {{app_name}}. Your learning journey starts here.", enabled: true, updatedAt },
      { id: "template-enrollment", key: "course_enrollment", name: "Course enrollment", channel: "Email", subject: "You are enrolled in {{course_name}}", body: "Your course is ready. Sign in to begin learning.", enabled: true, updatedAt },
      { id: "template-reminder", key: "lesson_reminder", name: "Lesson reminder", channel: "Push", subject: "Continue learning", body: "Your next lesson in {{course_name}} is waiting for you.", enabled: false, updatedAt },
    ] satisfies TemplateRecord[],
    orders: [] satisfies OrderRecord[],
  };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function initialStore(): Promise<AdminStore> {
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) throw new Error("ADMIN_INITIAL_PASSWORD must be configured before first login.");
  return {
    profile: { firstName: "Aarav", lastName: "Mehta", email: process.env.ADMIN_INITIAL_EMAIL ?? "admin@northstar.local", phone: "+91 98765 43210", jobTitle: "Founder & Lead Tutor", role: "Super Admin" },
    passwordHash: await hashPassword(initialPassword),
    sessionVersion: 1,
    studentSessionSecret: randomBytes(48).toString("hex"),
    settings: {
      siteName: "Northstar Learning", appName: "Northstar", companyName: "Aarav Mehta", websiteUrl: "https://northstar.example",
      supportEmail: "hello@northstar.example", supportPhone: "+91 98765 43210", businessAddress: "Indiranagar, Bengaluru, Karnataka 560038",
      linkedin: "https://linkedin.com/in/aarav", youtube: "https://youtube.com/@northstar", instagram: "https://instagram.com/northstar", twitter: "", logoUrl: "",
    },
    smtp: defaultSmtpSettings(),
    ...defaultResources(),
    updatedAt: new Date().toISOString(),
  };
}

export async function readAdminStore(): Promise<AdminStore> {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8")) as Partial<AdminStore>;
    const defaults = defaultResources();
    const mergeMissing = <T extends { id: string }>(current: T[] | undefined, seeded: T[]) => {
      const values = current ? [...current] : [];
      const ids = new Set(values.map((item) => item.id));
      for (const item of seeded) if (!ids.has(item.id)) values.push(item);
      return values;
    };
    const seededCategories = parsed.categories === undefined ? defaults.categories : [];
    const seededCourses = parsed.courses === undefined ? defaults.courses : [];
    const seededVideos = parsed.videos === undefined ? defaults.videos : [];
    const categories = mergeMissing(parsed.categories, seededCategories);
    const courses = mergeMissing(parsed.courses, seededCourses).map((course) => ({
      ...course,
      categoryId: course.categoryId ?? categories.find((category) => category.name === course.category)?.id ?? "",
      thumbnailUrl: course.thumbnailUrl ?? "",
      attachments: course.attachments ?? [],
      chapters: course.chapters ?? [],
    }));
    const videos = mergeMissing(parsed.videos, seededVideos);
    const students = (parsed.students ?? defaults.students).map((student) => ({ ...student, status: student.status ?? "Active", courseIds: student.courseIds ?? [], joinedAt: student.joinedAt ?? updatedDate() })) as StudentRecord[];
    const settings = { ...parsed.settings, logoUrl: parsed.settings?.logoUrl ?? "" } as GeneralSettings;
    const smtp = { ...defaultSmtpSettings(), ...(parsed.smtp ?? {}) };
    const studentSessionSecret = parsed.studentSessionSecret ?? randomBytes(48).toString("hex");
    const reviews = (parsed.reviews ?? []).map((review) => ({
      ...review,
      status: review.status ?? "Approved",
      submittedAt: review.submittedAt ?? review.updatedAt,
      moderatedAt: review.moderatedAt ?? review.updatedAt,
    })) as CourseReview[];
    const migrated = { ...parsed, studentSessionSecret, settings, smtp, categories, courses, videos, students, reviews, securityEvents: parsed.securityEvents ?? [], videoProgress: parsed.videoProgress ?? [], supportQueries: parsed.supportQueries ?? [], coupons: parsed.coupons ?? defaults.coupons, templates: parsed.templates ?? defaults.templates, orders: parsed.orders ?? [] } as AdminStore;
    const needsMigration = !parsed.categories || !parsed.courses || !parsed.students || !parsed.smtp || !parsed.reviews || parsed.reviews.some((review) => !review.status || !review.submittedAt || review.moderatedAt === undefined) || !parsed.securityEvents || !parsed.videoProgress || !parsed.supportQueries || !parsed.orders || !parsed.studentSessionSecret || parsed.settings?.logoUrl === undefined || categories.length !== parsed.categories?.length || courses.length !== parsed.courses?.length || videos.length !== parsed.videos?.length || parsed.courses?.some((course) => !course.categoryId || !course.chapters || !course.attachments);
    if (needsMigration) await writeAdminStore(migrated);
    return migrated;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const store = await initialStore();
    await writeAdminStore(store);
    return store;
  }
}

function updatedDate() { return new Date().toISOString().slice(0, 10); }

export async function writeAdminStore(store: AdminStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  store.updatedAt = new Date().toISOString();
  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(temporaryPath, storePath);
}

export function publicProfile(profile: AdminProfile) { return { ...profile }; }
