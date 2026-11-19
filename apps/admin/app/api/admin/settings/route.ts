import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { type GeneralSettings, writeAdminStore } from "../../../../lib/admin-store";

const fields: (keyof GeneralSettings)[] = ["siteName", "appName", "companyName", "websiteUrl", "supportEmail", "supportPhone", "businessAddress", "linkedin", "youtube", "instagram", "twitter", "logoUrl"];

export async function GET(request: NextRequest) {
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ settings: store.settings, updatedAt: store.updatedAt });
}

export async function PUT(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid settings data." }, { status: 400 });
  const settings = Object.fromEntries(fields.map((field) => [field, String(body[field] ?? "").trim()])) as unknown as GeneralSettings;
  if (!settings.siteName || !settings.appName || !settings.companyName || !settings.supportEmail.includes("@")) {
    return NextResponse.json({ error: "Site, app, company, and support email are required." }, { status: 400 });
  }
  if (settings.websiteUrl) {
    try { new URL(settings.websiteUrl); } catch { return NextResponse.json({ error: "Enter a valid website URL." }, { status: 400 }); }
  }
  if (settings.logoUrl && !settings.logoUrl.startsWith("/uploads/branding/")) {
    return NextResponse.json({ error: "Upload the logo through the branding control." }, { status: 400 });
  }
  store.settings = settings;
  await writeAdminStore(store);
  return NextResponse.json({ message: "General settings saved.", settings, updatedAt: store.updatedAt });
}
