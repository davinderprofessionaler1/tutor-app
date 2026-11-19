import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { writeAdminStore } from "../../../../lib/admin-store";

export async function GET(request: NextRequest) {
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ data: store.securityEvents });
}

export async function PATCH(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  const ids = new Set(body?.ids ?? store.securityEvents.map((event) => event.id));
  for (const event of store.securityEvents) if (ids.has(event.id)) event.read = true;
  await writeAdminStore(store);
  return NextResponse.json({ message: "Security alerts marked as read." });
}
