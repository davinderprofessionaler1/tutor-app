import cors from "@fastify/cors";
import Fastify from "fastify";
import { publicRoutes } from "./routes/public.js";
import { studentRoutes } from "./routes/student.js";
import { liveRoutes } from "./routes/live.js";
import type { LiveService } from "./live/service.js";

export function buildApp(options: { liveService?: LiveService; backgroundJobs?: boolean } = {}) {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [process.env.WEB_ORIGIN ?? "http://localhost:3000", process.env.ADMIN_ORIGIN ?? "http://localhost:3001"],
    credentials: true,
  });

  app.get("/health", async () => ({ status: "ok", service: "tutor-api", timestamp: new Date().toISOString() }));
  app.register(publicRoutes, { prefix: "/api/v1/public" });
  app.register(studentRoutes, { prefix: "/api/v1/student" });
  app.register(liveRoutes, { prefix: "/api/v1/live", service: options.liveService, backgroundJobs: options.backgroundJobs });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: "Route not found", path: request.url });
  });

  return app;
}
