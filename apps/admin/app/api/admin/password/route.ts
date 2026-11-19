import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { hashPassword, verifyPassword, writeAdminStore } from "../../../../lib/admin-store";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/session";

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export async function PATCH(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { currentPassword?: string; newPassword?: string } | null;
  if (!body || !await verifyPassword(body.currentPassword ?? "", store.passwordHash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }
  if (!strongPassword.test(body.newPassword ?? "")) {
    return NextResponse.json({ error: "Use 8+ characters with uppercase, lowercase, number, and symbol." }, { status: 400 });
  }
  store.passwordHash = await hashPassword(body.newPassword!);
  store.sessionVersion += 1;
  await writeAdminStore(store);
  const response = NextResponse.json({ message: "Password changed successfully." });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(store.sessionVersion), sessionCookieOptions);
  return response;
}
