import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { writeAdminStore } from "../../../../lib/admin-store";

export async function GET(request: NextRequest) {
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ data: [...store.supportQueries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}

export async function PATCH(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: string; status?: string; adminReply?: string } | null;
  const query = store.supportQueries.find((item) => item.id === body?.id);
  if (!query) return NextResponse.json({ error: "Support query not found." }, { status: 404 });
  if (!body?.status || !["Open", "In Progress", "Resolved"].includes(body.status)) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
  query.status = body.status as typeof query.status;
  query.adminReply = String(body.adminReply ?? "").trim().slice(0, 2000);
  query.updatedAt = new Date().toISOString();
  await writeAdminStore(store);
  return NextResponse.json({ message: "Support query updated.", data: query });
}
