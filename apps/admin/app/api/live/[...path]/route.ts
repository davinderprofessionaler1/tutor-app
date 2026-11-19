import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { SESSION_COOKIE } from "../../../../lib/session";

type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: NextRequest, context: Context) {
  if (request.method !== "GET" && !hasSafeOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const store = await authorizedStore(request);
  if (!store || !["Super Admin", "Admin"].includes(store.profile.role))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { path } = await context.params;
  if (path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
    return NextResponse.json({ error: "Invalid route." }, { status: 400 });
  const body = request.method === "GET" ? undefined : await request.text();
  if (body && body.length > 40000)
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  try {
    const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000/api/v1";
    const response = await fetch(
      `${base}/live/teacher/${path.join("/")}${request.nextUrl.search}`,
      {
        method: request.method,
        headers: {
          Authorization: `Bearer ${request.cookies.get(SESSION_COOKIE)?.value}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      },
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "The classroom server is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH };
