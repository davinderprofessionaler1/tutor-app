import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSafeOrigin } from "../../../../lib/api-auth";
import { publicProfile, readAdminStore, verifyPassword } from "../../../../lib/admin-store";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  const store = await readAdminStore();
  const valid = email === store.profile.email.toLowerCase() && await verifyPassword(password, store.passwordHash);
  if (!valid) return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 });
  const response = NextResponse.json({ profile: publicProfile(store.profile) });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(store.sessionVersion), sessionCookieOptions);
  return response;
}
