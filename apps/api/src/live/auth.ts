import { createHmac, timingSafeEqual } from "node:crypto";
import type { Actor, Platform } from "./types.js";
import { LiveError } from "./types.js";

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function payload(token: string, secret: string): Record<string, unknown> | null {
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra || !secret || !safeEqual(signature, createHmac("sha256", secret).update(data).digest("base64url"))) return null;
  try { return JSON.parse(Buffer.from(data, "base64url").toString()); } catch { return null; }
}
export function liveActor(header: string | undefined, platform: Platform, teacher = false): Actor {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (teacher) {
    const value = payload(token, process.env.ADMIN_SESSION_SECRET ?? "");
    if (!value || value.sub !== "admin" || !Number.isInteger(value.exp) || Number(value.exp) <= Date.now() / 1000 || value.version !== platform.sessionVersion) throw new LiveError(401, "Please sign in to the admin panel.");
    if (!["Super Admin", "Admin"].includes(platform.profile.role)) throw new LiveError(403, "Teacher access is required.");
    return { id: platform.profile.email.toLowerCase(), role: "teacher", name: `${platform.profile.firstName} ${platform.profile.lastName}`.trim(), email: platform.profile.email, courseIds: [] };
  }
  const value = payload(token, process.env.STUDENT_SESSION_SECRET ?? platform.studentSessionSecret);
  const student = platform.students.find((item) => item.id === value?.sub);
  if (!student) throw new LiveError(401, "Please sign in.");
  if (student.status !== "Active") throw new LiveError(403, "Your account is blocked.");
  return { id: student.id, role: "student", name: `${student.firstName} ${student.lastName}`.trim(), email: student.email, courseIds: student.courseIds };
}
