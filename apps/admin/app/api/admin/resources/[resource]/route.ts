import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../../lib/api-auth";
import { writeAdminStore } from "../../../../../lib/admin-store";

const resourceNames = ["categories", "courses", "videos", "students", "coupons", "templates"] as const;
type ResourceName = typeof resourceNames[number];
type RouteProps = { params: Promise<{ resource: string }> };

const allowedFields: Record<ResourceName, string[]> = {
  categories: ["name", "slug", "description", "active"],
  courses: ["title", "category", "categoryId", "thumbnailUrl", "attachments", "chapters", "status", "price", "salePrice", "lessons", "students", "featured"],
  videos: ["title", "course", "provider", "sourceUrl", "durationMinutes", "status", "downloadReady"],
  students: ["firstName", "lastName", "email", "phone", "status", "courseIds", "joinedAt"],
  coupons: ["code", "description", "discountType", "discountValue", "minimumOrder", "usageLimit", "used", "endsAt", "active"],
  templates: ["key", "name", "channel", "subject", "body", "enabled"],
};
const numberFields = new Set(["price", "salePrice", "lessons", "students", "durationMinutes", "discountValue", "minimumOrder", "usageLimit", "used"]);
const booleanFields = new Set(["featured", "downloadReady", "active", "enabled"]);

function isResource(value: string): value is ResourceName { return resourceNames.includes(value as ResourceName); }
function resourceArray(store: Awaited<ReturnType<typeof authorizedStore>>, resource: ResourceName) {
  return store![resource] as unknown as Array<Record<string, unknown>>;
}

function normalizedInput(resource: ResourceName, body: Record<string, unknown>) {
  const value: Record<string, unknown> = {};
  for (const field of allowedFields[resource]) {
    const raw = body[field];
    if (field === "attachments") value[field] = Array.isArray(raw) ? raw.map((attachment) => {
      const item = attachment as Record<string, unknown>;
      return { id: String(item.id || randomUUID()), name: String(item.name ?? "").trim(), url: String(item.url ?? "").trim(), sizeBytes: Math.max(0, Number(item.sizeBytes) || 0), mimeType: String(item.mimeType ?? "application/octet-stream") };
    }).filter((attachment) => attachment.name && attachment.url) : [];
    else if (field === "chapters") value[field] = Array.isArray(raw) ? raw.map((chapter) => {
      const item = chapter as Record<string, unknown>;
      return { id: String(item.id || randomUUID()), title: String(item.title ?? "").trim(), videoIds: Array.isArray(item.videoIds) ? item.videoIds.map(String) : [] };
    }).filter((chapter) => chapter.title) : [];
    else if (field === "courseIds") value[field] = Array.isArray(raw) ? [...new Set(raw.map(String).filter(Boolean))] : [];
    else if (numberFields.has(field)) value[field] = Math.max(0, Number(raw) || 0);
    else if (booleanFields.has(field)) value[field] = Boolean(raw);
    else value[field] = String(raw ?? "").trim();
  }
  if (resource === "coupons") value.code = String(value.code).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (resource === "templates") value.key = String(value.key).toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (resource === "categories") value.slug = String(value.slug || value.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (resource === "students") value.email = String(value.email).toLowerCase();
  return value;
}

function validate(resource: ResourceName, value: Record<string, unknown>) {
  if (resource === "categories" && (!value.name || !value.slug)) return "Category name is required.";
  if (resource === "courses" && (!value.title || !value.categoryId)) return "Course title and category are required.";
  if (resource === "videos" && (!value.title || !value.provider || !value.sourceUrl)) return "Video title, provider, and source URL are required.";
  if (resource === "students" && (!value.firstName || !value.lastName || !value.email)) return "Student name and email are required.";
  if (resource === "students" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value.email))) return "Enter a valid student email address.";
  if (resource === "students" && !["Active", "Blocked"].includes(String(value.status))) return "Student status must be Active or Blocked.";
  if (resource === "coupons" && (!value.code || Number(value.discountValue) <= 0)) return "Coupon code and a positive discount are required.";
  if (resource === "coupons" && value.discountType === "Percentage" && Number(value.discountValue) > 100) return "Percentage discounts cannot exceed 100%.";
  if (resource === "templates" && (!value.key || !value.name || !value.body)) return "Template key, name, and content are required.";
  return "";
}

function syncCourseStudentCounts(store: NonNullable<Awaited<ReturnType<typeof authorizedStore>>>) {
  for (const course of store.courses) course.students = store.students.filter((student) => student.courseIds.includes(course.id)).length;
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ data: resourceArray(store, resource) });
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  const input = normalizedInput(resource, body);
  const error = validate(resource, input);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (resource === "students" && (input.courseIds as string[]).some((id) => !store.courses.some((course) => course.id === id))) return NextResponse.json({ error: "One or more selected courses no longer exist." }, { status: 400 });
  const records = resourceArray(store, resource);
  const uniqueField = resource === "categories" ? "slug" : resource === "students" ? "email" : resource === "coupons" ? "code" : resource === "templates" ? "key" : null;
  if (uniqueField && records.some((item) => item[uniqueField] === input[uniqueField])) return NextResponse.json({ error: `${uniqueField === "code" ? "Coupon code" : uniqueField === "slug" ? "Category slug" : uniqueField === "email" ? "Student email" : "Template key"} already exists.` }, { status: 409 });
  const record = { id: randomUUID(), ...input, updatedAt: new Date().toISOString() };
  records.unshift(record);
  if (resource === "students") syncCourseStudentCounts(store);
  await writeAdminStore(store);
  return NextResponse.json({ message: "Created successfully.", data: record }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const records = resourceArray(store, resource);
  const index = records.findIndex((item) => item.id === body?.id);
  if (index < 0) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  const input = normalizedInput(resource, { ...records[index], ...body });
  const error = validate(resource, input);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (resource === "students" && (input.courseIds as string[]).some((id) => !store.courses.some((course) => course.id === id))) return NextResponse.json({ error: "One or more selected courses no longer exist." }, { status: 400 });
  const uniqueField = resource === "categories" ? "slug" : resource === "students" ? "email" : resource === "coupons" ? "code" : resource === "templates" ? "key" : null;
  if (uniqueField && records.some((item, itemIndex) => itemIndex !== index && item[uniqueField] === input[uniqueField])) return NextResponse.json({ error: `${uniqueField === "code" ? "Coupon code" : uniqueField === "slug" ? "Category slug" : uniqueField === "email" ? "Student email" : "Template key"} already exists.` }, { status: 409 });
  const record = { ...records[index], ...input, updatedAt: new Date().toISOString() };
  records[index] = record;
  if (resource === "students") syncCourseStudentCounts(store);
  await writeAdminStore(store);
  return NextResponse.json({ message: "Updated successfully.", data: record });
}

export async function DELETE(request: NextRequest, { params }: RouteProps) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const records = resourceArray(store, resource);
  const ids = request.nextUrl.searchParams.get("ids")?.split(",") ?? [request.nextUrl.searchParams.get("id") ?? ""];
  const targetIds = new Set(ids.map((id) => id.trim()).filter(Boolean));
  if (!targetIds.size) return NextResponse.json({ error: "Select at least one record to delete." }, { status: 400 });
  if ([...targetIds].some((id) => !records.some((item) => item.id === id))) {
    return NextResponse.json({ error: "One or more records were not found. Refresh and try again." }, { status: 404 });
  }
  if (resource === "categories" && store.courses.some((course) => targetIds.has(course.categoryId))) {
    return NextResponse.json({ error: "Move courses out of the selected categories before deleting them." }, { status: 409 });
  }
  if (resource === "courses" && store.students.some((student) => student.courseIds.some((id) => targetIds.has(id)))) {
    return NextResponse.json({ error: "Unassign the selected courses from students before deleting them." }, { status: 409 });
  }
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record && targetIds.has(String(record.id))) records.splice(index, 1);
  }
  if (resource === "videos") {
    for (const course of store.courses) {
      course.chapters = course.chapters.map((chapter) => ({ ...chapter, videoIds: chapter.videoIds.filter((id) => !targetIds.has(id)) }));
      course.lessons = course.chapters.reduce((total, chapter) => total + chapter.videoIds.length, 0);
    }
  }
  if (resource === "students") syncCourseStudentCounts(store);
  await writeAdminStore(store);
  return NextResponse.json({ message: targetIds.size === 1 ? "Deleted successfully." : `${targetIds.size} records deleted successfully.`, deletedIds: [...targetIds] });
}
