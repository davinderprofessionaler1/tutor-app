import type { NextRequest } from "next/server";
import { readAdminStore } from "./admin-store";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function hasSafeOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function authorizedStore(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const store = await readAdminStore();
  return session.version === store.sessionVersion ? store : null;
}
