import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { liveActor } from "../live/auth.js";
import { LiveService, type VideoEvent } from "../live/service.js";
import { LiveKitVideo } from "../live/providers.js";
import { LiveError } from "../live/types.js";

declare module "fastify" {
  interface FastifyRequest {
    liveRawBody?: string;
  }
}
type Params = { id: string; action: "start" | "end" | "cancel" };
const interaction = z
  .object({
    action: z.enum(["heartbeat", "leave", "hand", "chat"]),
    ticketId: z.string().uuid(),
    text: z.string().max(1000).optional(),
    raised: z.boolean().optional(),
  })
  .strict();
const moderation = z
  .object({
    action: z.enum(["permissions", "remove", "chat", "hide-message"]),
    identity: z.string().max(200).optional(),
    microphone: z.boolean().optional(),
    camera: z.boolean().optional(),
    enabled: z.boolean().optional(),
    messageId: z.string().uuid().optional(),
  })
  .strict();

export const liveRoutes: FastifyPluginAsync<{
  service?: LiveService;
  backgroundJobs?: boolean;
}> = async (app, options) => {
  if (
    !options.service &&
    process.env.NODE_ENV === "production" &&
    !process.env.LIVE_DATABASE_URL
  ) {
    // An unconfigured optional module must not stop the existing platform.
    app.all("/*", async (_request, reply) =>
      reply
        .status(503)
        .send({
          error: "Live Classes requires LIVE_DATABASE_URL in production.",
          code: "LIVE_NOT_CONFIGURED",
        }),
    );
    return;
  }
  const service = options.service ?? new LiveService();
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    ["application/json", "application/webhook+json"],
    { parseAs: "string", bodyLimit: 65536 },
    (request, body, done) => {
      request.liveRawBody = String(body);
      try {
        done(null, JSON.parse(String(body)));
      } catch {
        done(new LiveError(400, "Invalid JSON."));
      }
    },
  );
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .status(400)
        .send({
          error: error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        });
    if (error instanceof LiveError)
      return reply
        .status(error.statusCode)
        .send({ error: error.message, code: error.code });
    request.log.error(error, "Live classroom request failed");
    return reply
      .status(503)
      .send({
        error:
          "The classroom service is temporarily unavailable. Please try again.",
      });
  });
  const windows = new Map<string, { count: number; start: number }>();
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.includes("/webhooks/")) return;
    const now = Date.now(),
      key = `${request.ip}:${request.headers.authorization?.slice(-64) ?? "anonymous"}`;
    if (windows.size > 10000)
      for (const [ip, value] of windows)
        if (value.start < now - 60000) windows.delete(ip);
    let value = windows.get(key);
    if (!value || value.start < now - 60000) {
      value = { count: 0, start: now };
      windows.set(key, value);
    }
    if (++value.count > 600)
      return reply
        .status(429)
        .header("Retry-After", "60")
        .send({ error: "Too many requests. Please wait a minute." });
  });
  const actor = async (request: FastifyRequest, teacher = false) =>
    liveActor(request.headers.authorization, await service.platform(), teacher);
  for (const teacher of [false, true]) {
    const prefix = teacher ? "/teacher" : "";
    app.get(`${prefix}/classes`, async (request) =>
      service.list(
        await actor(request, teacher),
        z
          .object({ courseId: z.string().max(200).optional() })
          .parse(request.query).courseId,
      ),
    );
    app.get<{ Params: Params }>(`${prefix}/classes/:id`, async (request) =>
      service.detail(await actor(request, teacher), request.params.id),
    );
    app.post<{ Params: Params }>(
      `${prefix}/classes/:id/join`,
      async (request) =>
        service.join(await actor(request, teacher), request.params.id),
    );
    app.post<{ Params: Params }>(
      `${prefix}/classes/:id/interact`,
      async (request) =>
        service.interaction(
          await actor(request, teacher),
          request.params.id,
          interaction.parse(request.body),
        ),
    );
  }
  app.post("/teacher/classes", async (request, reply) =>
    reply
      .status(201)
      .send(await service.save(await actor(request, true), request.body)),
  );
  app.patch<{ Params: Params }>("/teacher/classes/:id", async (request) =>
    service.save(await actor(request, true), request.body, request.params.id),
  );
  app.post<{ Params: Params }>(
    "/teacher/classes/:id/:action",
    async (request) =>
      service.lifecycle(
        await actor(request, true),
        request.params.id,
        z.enum(["start", "end", "cancel"]).parse(request.params.action),
      ),
  );
  app.post<{ Params: Params }>(
    "/teacher/classes/:id/moderate",
    async (request) =>
      service.moderate(
        await actor(request, true),
        request.params.id,
        moderation.parse(request.body),
      ),
  );
  app.get("/teacher/reports", async (request) =>
    service.report(await actor(request, true)),
  );
  app.get<{ Params: Params }>("/teacher/classes/:id/report", async (request) =>
    service.report(await actor(request, true), request.params.id),
  );
  app.post<{ Params: Params }>("/teacher/orders/:id/refund", async (request) =>
    service.requestRefund(await actor(request, true), request.params.id),
  );
  app.post<{ Params: Params }>("/classes/:id/checkout", async (request) => {
    const data = z
      .object({
        kind: z.enum(["class", "course"]),
        idempotencyKey: z.string().min(8).max(100),
      })
      .strict()
      .parse(request.body);
    return service.checkout(
      await actor(request),
      request.params.id,
      data.kind,
      data.idempotencyKey,
    );
  });
  app.post<{ Params: Params }>("/orders/:id/verify", async (request) => {
    const data = z
      .object({
        paymentId: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
        signature: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .parse(request.body);
    return service.verifyPayment(
      await actor(request),
      request.params.id,
      data.paymentId,
      data.signature,
    );
  });
  app.get("/notifications", async (request) =>
    service.notifications(await actor(request)),
  );
  app.patch<{ Params: Params }>("/notifications/:id", async (request) =>
    service.notifications(await actor(request), request.params.id),
  );
  app.get("/history", async (request) => service.history(await actor(request)));
  app.post("/webhooks/razorpay", async (request) =>
    service.paymentWebhook(
      request.liveRawBody ?? "",
      String(request.headers["x-razorpay-signature"] ?? ""),
      String(request.headers["x-razorpay-event-id"] ?? ""),
    ),
  );
  app.post("/webhooks/livekit", async (request) => {
    if (!(service.video instanceof LiveKitVideo))
      throw new LiveError(503, "LiveKit webhook verification is unavailable.");
    let event;
    try {
      event = await service.video
        .receiver()
        .receive(request.liveRawBody ?? "", request.headers.authorization);
    } catch {
      throw new LiveError(401, "Invalid LiveKit webhook signature.");
    }
    return service.videoWebhook(event as unknown as VideoEvent);
  });
  app.get("/admission", async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
    await service.admission(token);
    return reply.status(204).send();
  });
  if (options.backgroundJobs !== false) {
    let running = false;
    const timer = setInterval(() => {
      if (running) return;
      running = true;
      service
        .tick()
        .catch((error) =>
          app.log.error(error, "Live classroom reconciliation failed"),
        )
        .finally(() => {
          running = false;
        });
    }, 15000);
    timer.unref();
    app.addHook("onClose", async () => {
      clearInterval(timer);
      await service.repository.close?.();
    });
  }
};
