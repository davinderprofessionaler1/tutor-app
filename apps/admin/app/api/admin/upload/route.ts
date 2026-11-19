import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]);
const attachmentTypes = new Set(["application/pdf", "application/zip", "application/x-zip-compressed", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain"]);
const attachmentExtensions = new Set([".pdf", ".zip", ".doc", ".docx", ".ppt", ".pptx", ".txt"]);
const extensions: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov", "video/x-matroska": ".mkv", "application/pdf": ".pdf", "application/zip": ".zip", "application/x-zip-compressed": ".zip", "application/msword": ".doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx", "application/vnd.ms-powerpoint": ".ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx", "text/plain": ".txt" };

export async function PUT(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await authorizedStore(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const kind = request.nextUrl.searchParams.get("kind");
  const originalName = request.nextUrl.searchParams.get("filename") ?? "upload";
  const contentType = request.headers.get("content-type")?.split(";")[0] ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  const isImage = kind === "thumbnail" || kind === "logo";
  const isAttachment = kind === "attachment";
  const originalExtension = path.extname(originalName).toLowerCase();
  const isGenericSafeAttachment = contentType === "application/octet-stream" && attachmentExtensions.has(originalExtension);
  const allowed = isImage ? imageTypes.has(contentType) : kind === "video" ? videoTypes.has(contentType) : isAttachment ? attachmentTypes.has(contentType) || isGenericSafeAttachment : false;
  const maximum = kind === "logo" ? 5 * 1024 * 1024 : kind === "thumbnail" ? 10 * 1024 * 1024 : isAttachment ? 50 * 1024 * 1024 : 1024 * 1024 * 1024;
  if (!allowed) return NextResponse.json({ error: isImage ? "Upload a JPG, PNG, WebP, or GIF image." : isAttachment ? "Upload a PDF, ZIP, Word, PowerPoint, or text file." : "Upload an MP4, WebM, MOV, or MKV video." }, { status: 415 });
  if (!contentLength || contentLength > maximum) return NextResponse.json({ error: `File must be smaller than ${kind === "logo" ? "5 MB" : kind === "thumbnail" ? "10 MB" : isAttachment ? "50 MB" : "1 GB"}.` }, { status: 413 });
  if (!request.body) return NextResponse.json({ error: "No file was received." }, { status: 400 });

  const packageRoot = process.cwd().replaceAll("\\", "/").endsWith("/apps/admin") ? process.cwd() : path.join(process.cwd(), "apps", "admin");
  const folderName = kind === "logo" ? "branding" : kind === "thumbnail" ? "thumbnails" : isAttachment ? "attachments" : "videos";
  const uploadDirectory = path.join(packageRoot, "public", "uploads", folderName);
  const safeBaseName = path.parse(originalName).name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(-80) || "upload";
  const fileName = `${randomUUID()}-${safeBaseName}${extensions[contentType] ?? originalExtension}`;
  const destination = path.join(uploadDirectory, fileName);

  try {
    await mkdir(uploadDirectory, { recursive: true });
    await pipeline(Readable.fromWeb(request.body as never), createWriteStream(destination, { flags: "wx" }));
    return NextResponse.json({ message: "Upload complete.", url: `/uploads/${folderName}/${fileName}`, fileName: originalName, size: contentLength, contentType });
  } catch (error) {
    await rm(destination, { force: true }).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? `Upload failed: ${error.message}` : "Upload failed." }, { status: 500 });
  }
}
