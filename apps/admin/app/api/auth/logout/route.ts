import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSafeOrigin } from "../../../../lib/api-auth";
import { SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
