import type { FastifyPluginAsync } from "fastify";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { publicBranding, publicCourses } from "../data/demo.js";

type BrandStore = { updatedAt?: string; settings?: { siteName?: string; appName?: string; companyName?: string; supportEmail?: string; logoUrl?: string } };
const storePath = path.resolve(import.meta.dirname, "../../../admin/data/admin-store.json");
const brandingDirectory = path.resolve(import.meta.dirname, "../../../admin/public/uploads/branding");
const thumbnailDirectory = path.resolve(import.meta.dirname, "../../../admin/public/uploads/thumbnails");
const attachmentDirectory = path.resolve(import.meta.dirname, "../../../admin/public/uploads/attachments");
const videoDirectory = path.resolve(import.meta.dirname, "../../../admin/public/uploads/videos");

async function readBrandStore() {
  try { return JSON.parse(await readFile(storePath, "utf8")) as BrandStore; }
  catch { return {} as BrandStore; }
}

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  featured: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const publicRoutes: FastifyPluginAsync = async (app) => {
  app.get("/settings", async () => {
    const store = await readBrandStore();
    const settings = store.settings;
    return { data: {
      ...publicBranding,
      siteName: settings?.siteName || publicBranding.siteName,
      appName: settings?.appName || settings?.siteName || publicBranding.siteName,
      tutorName: settings?.companyName || publicBranding.tutorName,
      supportEmail: settings?.supportEmail || publicBranding.supportEmail,
      logoUrl: settings?.logoUrl ? `/api/v1/public/branding/logo?v=${encodeURIComponent(store.updatedAt ?? "")}` : "",
    } };
  });

  app.get("/branding/logo", async (_request, reply) => {
    const store = await readBrandStore();
    const logoUrl = store.settings?.logoUrl;
    if (!logoUrl?.startsWith("/uploads/branding/")) return reply.status(404).send({ error: "Logo not configured" });
    const fileName = path.basename(logoUrl);
    const extension = path.extname(fileName).toLowerCase();
    const contentTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
    const contentType = contentTypes[extension];
    if (!contentType) return reply.status(404).send({ error: "Logo not found" });
    try {
      const logo = await readFile(path.join(brandingDirectory, fileName));
      return reply.header("Cache-Control", "no-cache").type(contentType).send(logo);
    } catch { return reply.status(404).send({ error: "Logo not found" }); }
  });

  app.get<{ Params: { fileName: string } }>("/course-thumbnail/:fileName", async (request, reply) => {
    const fileName = path.basename(request.params.fileName);
    const extension = path.extname(fileName).toLowerCase();
    const contentTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
    const contentType = contentTypes[extension];
    if (!contentType) return reply.status(404).send({ error: "Thumbnail not found" });
    try {
      const thumbnail = await readFile(path.join(thumbnailDirectory, fileName));
      return reply.header("Cache-Control", "public, max-age=3600").type(contentType).send(thumbnail);
    } catch { return reply.status(404).send({ error: "Thumbnail not found" }); }
  });

  app.get<{ Params: { fileName: string } }>("/course-attachment/:fileName", async (request, reply) => {
    const fileName = path.basename(request.params.fileName);
    const contentTypes: Record<string, string> = { ".pdf": "application/pdf", ".zip": "application/zip", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".txt": "text/plain" };
    const contentType = contentTypes[path.extname(fileName).toLowerCase()];
    if (!contentType) return reply.status(404).send({ error: "Attachment not found" });
    try {
      const file = await readFile(path.join(attachmentDirectory, fileName));
      return reply.header("Content-Disposition", `attachment; filename="${fileName.replaceAll('"', '')}"`).type(contentType).send(file);
    } catch { return reply.status(404).send({ error: "Attachment not found" }); }
  });

  app.get<{ Params: { fileName: string } }>("/course-video/:fileName", async (request, reply) => {
    const fileName = path.basename(request.params.fileName);
    const contentTypes: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska" };
    const contentType = contentTypes[path.extname(fileName).toLowerCase()];
    if (!contentType) return reply.status(404).send({ error: "Video not found" });
    const filePath = path.join(videoDirectory, fileName);
    try {
      const details = await stat(filePath);
      const range = request.headers.range;
      if (!range) return reply.header("Accept-Ranges", "bytes").header("Content-Length", details.size).type(contentType).send(createReadStream(filePath));
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return reply.status(416).header("Content-Range", `bytes */${details.size}`).send();
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), details.size - 1) : details.size - 1;
      if (start > end || start >= details.size) return reply.status(416).header("Content-Range", `bytes */${details.size}`).send();
      return reply.status(206).header("Accept-Ranges", "bytes").header("Content-Range", `bytes ${start}-${end}/${details.size}`).header("Content-Length", end - start + 1).type(contentType).send(createReadStream(filePath, { start, end }));
    } catch { return reply.status(404).send({ error: "Video not found" }); }
  });

  app.get("/courses", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid course filters", details: parsed.error.flatten() });
    }

    const { search, category, featured, page, pageSize } = parsed.data;
    const normalizedSearch = search?.toLocaleLowerCase();
    const filtered = publicCourses.filter((course) => {
      const matchesSearch =
        !normalizedSearch ||
        course.title.toLocaleLowerCase().includes(normalizedSearch) ||
        course.shortDescription.toLocaleLowerCase().includes(normalizedSearch);
      const matchesCategory = !category || course.category.toLocaleLowerCase() === category.toLocaleLowerCase();
      const matchesFeatured = featured === undefined || course.featured === (featured === "true");
      return matchesSearch && matchesCategory && matchesFeatured;
    });

    const start = (page - 1) * pageSize;
    return {
      data: filtered.slice(start, start + pageSize),
      meta: { total: filtered.length, page, pageSize },
    };
  });

  app.get<{ Params: { slug: string } }>("/courses/:slug", async (request, reply) => {
    const course = publicCourses.find((item) => item.slug === request.params.slug);
    if (!course) return reply.status(404).send({ error: "Course not found" });
    return { data: course };
  });
};
