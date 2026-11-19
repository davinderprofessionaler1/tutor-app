import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { publicProfile, writeAdminStore } from "../../../../lib/admin-store";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ profile: publicProfile(store.profile) });
}

export async function PATCH(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid profile data." }, { status: 400 });
  const profile = {
    ...store.profile,
    firstName: String(body.firstName ?? "").trim(), lastName: String(body.lastName ?? "").trim(),
    email: String(body.email ?? "").trim().toLowerCase(), phone: String(body.phone ?? "").trim(), jobTitle: String(body.jobTitle ?? "").trim(),
  };
  if (!profile.firstName || !profile.lastName || !emailPattern.test(profile.email)) {
    return NextResponse.json({ error: "Enter a valid name and email address." }, { status: 400 });
  }
  store.profile = profile;
  await writeAdminStore(store);
  return NextResponse.json({ message: "Profile updated successfully.", profile: publicProfile(profile) });
}
