import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readAdminStore } from "./lib/admin-store";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const store = session ? await readAdminStore().catch(() => null) : null;
  const validSession = Boolean(session && store && session.version === store.sessionVersion);
  const isLogin = request.nextUrl.pathname === "/login";
  if (!validSession && !isLogin) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (validSession && isLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico|icon.svg).*)"] };
