import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendMail } from "../lib/smtp.js";
import { purchasedLiveCourseIds } from "../live/store.js";

type Student = { id: string; firstName: string; lastName: string; email: string; phone: string; status: "Active" | "Blocked"; courseIds: string[]; joinedAt: string; updatedAt: string };
type Video = { id: string; title: string; provider: string; sourceUrl: string; durationMinutes: number; status: string };
type Chapter = { id: string; title: string; videoIds: string[] };
type Attachment = { id: string; name: string; url: string; sizeBytes: number; mimeType: string };
type Review = { id: string; courseId: string; studentId: string; studentName: string; rating: number; comment: string; status: "Pending" | "Approved" | "Rejected"; submittedAt: string; moderatedAt: string; updatedAt: string };
type SecurityEvent = { id: string; studentId: string; studentName: string; studentEmail: string; eventType: "screenshot" | "screen_recording"; videoTitle: string; detectedAt: string; read: boolean };
type VideoProgress = { id: string; studentId: string; videoId: string; positionSeconds: number; durationSeconds: number; completed: boolean; reportedAt: number; updatedAt: string };
type SupportQuery = { id: string; referenceNumber: string; studentId: string; studentName: string; studentEmail: string; subject: string; message: string; status: "Open" | "In Progress" | "Resolved"; adminReply: string; createdAt: string; updatedAt: string };
type Course = { id: string; title: string; category: string; thumbnailUrl: string; attachments?: Attachment[]; chapters: Chapter[]; status: string; lessons: number; featured: boolean };
type Store = Record<string, unknown> & { students: Student[]; courses: Course[]; videos: Video[]; reviews: Review[]; securityEvents: SecurityEvent[]; videoProgress: VideoProgress[]; supportQueries: SupportQuery[]; studentSessionSecret: string; updatedAt: string };
type OtpChallenge = { hash: string; expiresAt: number; attempts: number; lastSentAt: number };

const storePath = path.resolve(import.meta.dirname, "../../../admin/data/admin-store.json");
const otpChallenges = new Map<string, OtpChallenge>();
const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });
const verifySchema = emailSchema.extend({ otp: z.string().regex(/^\d{6}$/) });
const profileSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), phone: z.string().trim().max(30) });
const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().min(2).max(1000) });
const securityEventSchema = z.object({ eventType: z.enum(["screenshot", "screen_recording"]), videoTitle: z.string().trim().min(1).max(240) });
const progressSchema = z.object({ videoId: z.string().trim().min(1).max(200), positionSeconds: z.coerce.number().finite().min(0).max(60 * 60 * 24 * 7), durationSeconds: z.coerce.number().finite().min(0).max(60 * 60 * 24 * 7), completed: z.boolean().optional().default(false), reportedAt: z.coerce.number().int().positive().optional() });
const supportQuerySchema = z.object({ subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(2000) });

async function readStore() {
  const store = JSON.parse(await readFile(storePath, "utf8")) as Store;
  store.reviews ??= [];
  store.securityEvents ??= [];
  store.videoProgress ??= [];
  store.supportQueries ??= [];
  if (!store.studentSessionSecret) {
    store.studentSessionSecret = randomBytes(48).toString("hex");
    await writeStore(store);
  }
  return store;
}
async function writeStore(store: Store) {
  store.updatedAt = new Date().toISOString();
  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(temporaryPath, storePath);
}
function sessionSecret(store: Store) { return process.env.STUDENT_SESSION_SECRET ?? store.studentSessionSecret; }
function otpHash(email: string, otp: string, secret: string) { return createHash("sha256").update(`${secret}:${email}:${otp}`).digest("hex"); }
function encode(value: string) { return Buffer.from(value).toString("base64url"); }
function sign(value: string, secret: string) { return createHmac("sha256", secret).update(value).digest("base64url"); }
function createToken(studentId: string, secret: string) { const payload = encode(JSON.stringify({ sub: studentId })); return `${payload}.${sign(payload, secret)}`; }
function verifyToken(token: string, secret: string) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload, secret)); const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown }; return typeof value.sub === "string" && value.sub ? value.sub : null; } catch { return null; }
}
async function currentStudent(request: FastifyRequest) {
  const store = await readStore();
  const header = request.headers.authorization;
  const id = header?.startsWith("Bearer ") ? verifyToken(header.slice(7), sessionSecret(store)) : null;
  if (!id) return { error: "UNAUTHORIZED" as const };
  const student = store.students.find((item) => item.id === id);
  if (!student) return { error: "UNAUTHORIZED" as const };
  if (student.status === "Blocked") return { error: "STUDENT_BLOCKED" as const };
  const courseIds = [...new Set([...student.courseIds, ...await purchasedLiveCourseIds(student.id)])];
  return { student, store, courseIds };
}
function publicStudent(student: Student) { return { id: student.id, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone, status: student.status, courseIds: student.courseIds, joinedAt: student.joinedAt }; }
function thumbnailUrl(request: FastifyRequest, value: string) {
  if (!value.startsWith("/uploads/thumbnails/")) return value;
  const fileName = encodeURIComponent(path.basename(value));
  return `${request.protocol}://${request.headers.host}/api/v1/public/course-thumbnail/${fileName}`;
}
function publicUploadUrl(request: FastifyRequest, value: string, folder: "attachments" | "videos", route: "course-attachment" | "course-video") {
  if (!value.startsWith(`/uploads/${folder}/`)) return value;
  return `${request.protocol}://${request.headers.host}/api/v1/public/${route}/${encodeURIComponent(path.basename(value))}`;
}
function progressFor(store: Store, studentId: string, video: Video) {
  const saved = store.videoProgress.find((item) => item.studentId === studentId && item.videoId === video.id);
  const durationSeconds = Math.max(1, saved?.durationSeconds || video.durationMinutes * 60);
  const positionSeconds = Math.min(durationSeconds, Math.max(0, saved?.positionSeconds ?? 0));
  return { progressSeconds: Math.round(positionSeconds), durationSeconds: Math.round(durationSeconds), completed: saved?.completed === true };
}
function courseProgress(store: Store, studentId: string, course: Course) {
  const videos = course.chapters.flatMap((chapter) => chapter.videoIds.map((id) => store.videos.find((video) => video.id === id)).filter((video): video is Video => Boolean(video) && video!.status === "Ready"));
  const progress = videos.map((video) => progressFor(store, studentId, video));
  const totalSeconds = progress.reduce((total, item) => total + item.durationSeconds, 0);
  const watchedSeconds = progress.reduce((total, item) => total + (item.completed ? item.durationSeconds : item.progressSeconds), 0);
  return { progressPercent: totalSeconds ? Math.min(100, Math.round(watchedSeconds / totalSeconds * 100)) : 0, completedVideoCount: progress.filter((item) => item.completed).length };
}

export const studentRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/request-otp", async (request, reply) => {
    const parsed = emailSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Enter a valid email address." });
    const { email } = parsed.data;
    const store = await readStore();
    const student = store.students.find((item) => item.email.toLowerCase() === email);
    if (student?.status === "Blocked") return reply.status(403).send({ error: "Your account has been blocked. Contact support.", code: "STUDENT_BLOCKED" });
    if (!student) return reply.status(404).send({ error: "No student account was found for this email address.", code: "STUDENT_NOT_FOUND" });
    const existing = otpChallenges.get(email);
    if (existing && Date.now() - existing.lastSentAt < 60_000) return reply.status(429).send({ error: "Please wait one minute before requesting another code." });
    const otp = String(randomInt(100000, 1000000));
    try {
      await sendMail({
        to: email,
        subject: `${otp} is your sign-in code`,
        text: `Hi ${student.firstName},\n\nYour Tutor App sign-in code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request it, you can ignore this email.\n`,
      });
    } catch (error) {
      request.log.error(error, "Could not send student OTP");
      return reply.status(503).send({ error: "We could not send the email right now. Please try again." });
    }
    otpChallenges.set(email, { hash: otpHash(email, otp, sessionSecret(store)), expiresAt: Date.now() + 10 * 60_000, attempts: 0, lastSentAt: Date.now() });
    return { message: "A 6-digit sign-in code was sent to your email. It expires in 10 minutes." };
  });

  app.post("/auth/verify-otp", async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Enter the 6-digit code from your email." });
    const { email, otp } = parsed.data;
    const challenge = otpChallenges.get(email);
    if (!challenge || challenge.expiresAt < Date.now()) { otpChallenges.delete(email); return reply.status(400).send({ error: "This code has expired. Request a new one." }); }
    if (challenge.attempts >= 5) { otpChallenges.delete(email); return reply.status(429).send({ error: "Too many attempts. Request a new code." }); }
    challenge.attempts += 1;
    const store = await readStore();
    const expected = Buffer.from(challenge.hash); const supplied = Buffer.from(otpHash(email, otp, sessionSecret(store)));
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return reply.status(400).send({ error: "The sign-in code is incorrect." });
    const student = store.students.find((item) => item.email.toLowerCase() === email);
    if (!student) return reply.status(401).send({ error: "Student account not found." });
    if (student.status === "Blocked") return reply.status(403).send({ error: "Your account has been blocked. Contact support.", code: "STUDENT_BLOCKED" });
    otpChallenges.delete(email);
    return { token: createToken(student.id, sessionSecret(store)), student: publicStudent(student) };
  });

  app.get("/me", async (request, reply) => {
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    return { student: publicStudent(auth.student) };
  });

  app.patch("/me", async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "First name and last name are required." });
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    Object.assign(auth.student, parsed.data, { updatedAt: new Date().toISOString() });
    await writeStore(auth.store);
    return { message: "Profile updated.", student: publicStudent(auth.student) };
  });

  app.get("/tutorials", async (request, reply) => {
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    const assigned = auth.store.courses.filter((course) => auth.courseIds.includes(course.id) && course.status === "Published").map((course) => {
      const summary = courseProgress(auth.store, auth.student.id, course);
      return {
        id: course.id, title: course.title, category: course.category, thumbnailUrl: thumbnailUrl(request, course.thumbnailUrl), lessons: course.lessons, featured: course.featured, ...summary,
        attachments: (course.attachments ?? []).map((attachment) => ({ ...attachment, url: publicUploadUrl(request, attachment.url, "attachments", "course-attachment") })),
        reviews: auth.store.reviews.filter((review) => review.courseId === course.id && (review.status ?? "Approved") === "Approved"),
        chapters: course.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, videos: chapter.videoIds.map((id) => auth.store.videos.find((video) => video.id === id)).filter((video): video is Video => Boolean(video) && video!.status === "Ready").map((video) => ({ id: video.id, title: video.title, provider: video.provider, sourceUrl: publicUploadUrl(request, video.sourceUrl, "videos", "course-video"), durationMinutes: video.durationMinutes, ...progressFor(auth.store, auth.student.id, video) })) })),
      };
    });
    return { data: assigned, meta: { total: assigned.length, videos: assigned.reduce((total, course) => total + course.chapters.reduce((sum, chapter) => sum + chapter.videos.length, 0), 0) } };
  });

  app.post<{ Params: { courseId: string } }>("/tutorials/:courseId/reviews", async (request, reply) => {
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Choose a rating and write a short review." });
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    if (!auth.courseIds.includes(request.params.courseId)) return reply.status(403).send({ error: "Only assigned students can review this course." });
    const existing = auth.store.reviews.find((review) => review.courseId === request.params.courseId && review.studentId === auth.student.id);
    const submittedAt = new Date().toISOString();
    const review: Review = { id: existing?.id ?? randomBytes(16).toString("hex"), courseId: request.params.courseId, studentId: auth.student.id, studentName: `${auth.student.firstName} ${auth.student.lastName}`.trim(), rating: parsed.data.rating, comment: parsed.data.comment, status: "Pending", submittedAt, moderatedAt: "", updatedAt: submittedAt };
    if (existing) Object.assign(existing, review); else auth.store.reviews.push(review);
    await writeStore(auth.store);
    return reply.status(202).send({ message: "Your review will be verified by admin and published within 24 hours.", data: review });
  });

  app.post("/security-events", async (request, reply) => {
    const parsed = securityEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid security event." });
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    const now = new Date();
    const duplicate = auth.store.securityEvents.find((event) => event.studentId === auth.student.id && event.eventType === parsed.data.eventType && event.videoTitle === parsed.data.videoTitle && now.getTime() - new Date(event.detectedAt).getTime() < 10_000);
    if (duplicate) return reply.status(202).send({ message: "Security event already reported.", data: duplicate });
    const event: SecurityEvent = {
      id: randomBytes(16).toString("hex"),
      studentId: auth.student.id,
      studentName: `${auth.student.firstName} ${auth.student.lastName}`.trim(),
      studentEmail: auth.student.email,
      eventType: parsed.data.eventType,
      videoTitle: parsed.data.videoTitle,
      detectedAt: now.toISOString(),
      read: false,
    };
    auth.store.securityEvents.unshift(event);
    auth.store.securityEvents.splice(200);
    await writeStore(auth.store);
    return reply.status(201).send({ message: "Security event reported.", data: event });
  });

  app.post("/progress", async (request, reply) => {
    const parsed = progressSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid video progress." });
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    const video = auth.store.videos.find((item) => item.id === parsed.data.videoId && item.status === "Ready");
    const assignedCourse = auth.store.courses.find((course) => auth.courseIds.includes(course.id) && course.chapters.some((chapter) => chapter.videoIds.includes(parsed.data.videoId)));
    if (!video || !assignedCourse) return reply.status(404).send({ error: "Assigned video not found." });
    const durationSeconds = Math.max(1, Math.round(parsed.data.durationSeconds || video.durationMinutes * 60));
    const rawPosition = Math.min(durationSeconds, Math.max(0, Math.round(parsed.data.positionSeconds)));
    const completed = parsed.data.completed || rawPosition >= Math.max(1, durationSeconds - 5);
    const positionSeconds = completed ? durationSeconds : rawPosition;
    const existing = auth.store.videoProgress.find((item) => item.studentId === auth.student.id && item.videoId === video.id);
    const reportedAt = parsed.data.reportedAt ?? Date.now();
    if (existing?.reportedAt && reportedAt < existing.reportedAt) return { message: "Newer progress already saved.", data: existing, course: courseProgress(auth.store, auth.student.id, assignedCourse) };
    const progress: VideoProgress = { id: existing?.id ?? randomBytes(16).toString("hex"), studentId: auth.student.id, videoId: video.id, positionSeconds, durationSeconds, completed: completed || existing?.completed === true, reportedAt, updatedAt: new Date().toISOString() };
    if (existing) Object.assign(existing, progress); else auth.store.videoProgress.push(progress);
    await writeStore(auth.store);
    return { message: "Progress saved.", data: progress, course: courseProgress(auth.store, auth.student.id, assignedCourse) };
  });

  app.get("/support-queries", async (request, reply) => {
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    const queries = auth.store.supportQueries
      .filter((query) => query.studentId === auth.student.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { data: queries };
  });

  app.post("/support-queries", async (request, reply) => {
    const parsed = supportQuerySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Enter a subject and at least 10 characters describing your query." });
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    const now = new Date().toISOString();
    const query: SupportQuery = {
      id: randomBytes(16).toString("hex"),
      referenceNumber: `SUP-${now.slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
      studentId: auth.student.id,
      studentName: `${auth.student.firstName} ${auth.student.lastName}`.trim(),
      studentEmail: auth.student.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: "Open",
      adminReply: "",
      createdAt: now,
      updatedAt: now,
    };
    auth.store.supportQueries.unshift(query);
    await writeStore(auth.store);
    return reply.status(201).send({ message: `Query submitted. Reference ${query.referenceNumber}.`, data: query });
  });

  app.get("/featured", async (request, reply) => {
    const auth = await currentStudent(request);
    if ("error" in auth) return reply.status(403).send({ error: auth.error === "STUDENT_BLOCKED" ? "Your account has been blocked." : "Please sign in.", code: auth.error });
    const featured = auth.store.courses
      .filter((course) => course.status === "Published" && course.featured)
      .map((course) => ({
        id: course.id,
        title: course.title,
        category: course.category,
        thumbnailUrl: thumbnailUrl(request, course.thumbnailUrl),
        lessons: course.lessons,
        featured: true,
        ...courseProgress(auth.store, auth.student.id, course),
        chapters: [],
      }));
    return { data: featured, meta: { total: featured.length } };
  });
};
