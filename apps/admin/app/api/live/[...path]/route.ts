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
  const recording =
    path.length === 3 && path[0] === "classes" && path[2] === "recording";
  const binary = recording && request.method === "POST";
  const contentType = request.headers.get("content-type")?.split(";")[0] ?? "";
  if (binary && !["video/webm", "video/mp4"].includes(contentType))
    return NextResponse.json({ error: "Upload WebM or MP4." }, { status: 415 });
  if (
    binary &&
    Number(request.headers.get("content-length")) > 100 * 1024 * 1024
  )
    return NextResponse.json(
      { error: "Recordings must be under 100 MB." },
      { status: 413 },
    );
  const body =
    request.method === "GET" || binary ? undefined : await request.text();
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
          "Content-Type": binary ? contentType : "application/json",
        },
        ...(binary
          ? { body: request.body, duplex: "half" }
          : body
            ? { body }
            : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(binary ? 600000 : 20000),
      },
    );
    if (recording && request.method === "GET" && response.ok)
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("content-type") ?? "application/octet-stream",
          "Content-Disposition":
            response.headers.get("content-disposition") ?? "attachment",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
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
