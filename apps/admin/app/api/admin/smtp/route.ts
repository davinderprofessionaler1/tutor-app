import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import { type SmtpSettings, writeAdminStore } from "../../../../lib/admin-store";

function publicSmtp(settings: SmtpSettings) {
  const { password: _password, ...safe } = settings;
  return { ...safe, password: "", passwordConfigured: Boolean(settings.password) };
}

export async function GET(request: NextRequest) {
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ smtp: publicSmtp(store.smtp), updatedAt: store.updatedAt });
}

export async function PUT(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid SMTP settings." }, { status: 400 });

  const port = Number(body.port);
  const fromEmail = String(body.fromEmail ?? "").trim().toLowerCase();
  if (!String(body.host ?? "").trim() || !Number.isInteger(port) || port < 1 || port > 65535 || !fromEmail.includes("@")) {
    return NextResponse.json({ error: "Host, a valid port, and sender email are required." }, { status: 400 });
  }

  store.smtp = {
    host: String(body.host).trim(),
    port,
    secure: Boolean(body.secure),
    username: String(body.username ?? "").trim(),
    password: String(body.password ?? "") || store.smtp.password,
    fromName: String(body.fromName ?? "").trim(),
    fromEmail,
  };
  await writeAdminStore(store);
  return NextResponse.json({ message: "SMTP settings saved.", smtp: publicSmtp(store.smtp), updatedAt: store.updatedAt });
}
