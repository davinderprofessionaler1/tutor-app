import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { LiveService, type ClassInput } from "../src/live/service.js";
import {
  emptyLiveState,
  type Actor,
  type JoinTicket,
  type LiveOrder,
  type LiveRepository,
  type LiveState,
  type Platform,
} from "../src/live/types.js";
import {
  LiveKitVideo,
  RazorpayGateway,
  type ClassroomVideo,
  type PaymentGateway,
  type VerifiedPayment,
} from "../src/live/providers.js";
import Fastify from "fastify";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { Readable } from "node:stream";
import { RecordingFiles } from "../src/live/recordings.js";
import { liveRoutes } from "../src/routes/live.js";
import { buildApp } from "../src/app.js";

class MemoryRepository implements LiveRepository {
  state = emptyLiveState();
  private queue: Promise<unknown> = Promise.resolve();
  transaction<T>(work: (state: LiveState) => T | Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const state = structuredClone(this.state);
      const value = await work(state);
      this.state = state;
      return structuredClone(value);
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
class FakeVideo implements ClassroomVideo {
  calls: {
    action: string;
    identity?: string;
    microphone?: boolean;
    camera?: boolean;
  }[] = [];
  configured() {
    return true;
  }
  async createRoom() {
    this.calls.push({ action: "create" });
  }
  async deleteRoom() {
    this.calls.push({ action: "delete" });
  }
  async token(ticket: JoinTicket) {
    return JSON.stringify({
      identity: ticket.identity,
      canPublish: false,
      canSubscribe: true,
    });
  }
  async permissions(
    _room: string,
    identity: string,
    _role: string,
    microphone: boolean,
    camera: boolean,
  ) {
    this.calls.push({ action: "permissions", identity, microphone, camera });
  }
  async remove(_room: string, identity: string) {
    this.calls.push({ action: "remove", identity });
  }
}
class FakePayments implements PaymentGateway {
  captures = new Map<string, VerifiedPayment>();
  creates = 0;
  failCreate = false;
  configured() {
    return true;
  }
  async create(order: LiveOrder) {
    this.creates++;
    if (this.failCreate) throw new Error("Network timeout");
    return `order_${order.id}`;
  }
  async verify(order: LiveOrder, id: string, signature?: string) {
    const payment = this.captures.get(id);
    assert.ok(
      signature === undefined || signature === "valid",
      "invalid signature",
    );
    assert.ok(
      payment &&
        payment.status === "captured" &&
        payment.order_id === order.providerOrderId &&
        payment.amount === order.amount &&
        payment.currency === order.currency,
      "payment not captured or mismatched",
    );
    return payment;
  }
  async refund() {}
}
const teacher: Actor = {
  id: "teacher@example.test",
  role: "teacher",
  name: "Teacher",
  email: "teacher@example.test",
  courseIds: [],
};
const student: Actor = {
  id: "s1",
  role: "student",
  name: "Student One",
  email: "one@example.test",
  courseIds: [],
};
const second: Actor = {
  ...student,
  id: "s2",
  name: "Student Two",
  email: "two@example.test",
};
function fixture() {
  const repo = new MemoryRepository(),
    video = new FakeVideo(),
    payments = new FakePayments();
  let now = Date.parse("2026-11-19T12:00:00Z");
  const platform: Platform = {
    profile: {
      firstName: "Teacher",
      lastName: "One",
      email: teacher.id,
      role: "Super Admin",
    },
    sessionVersion: 1,
    studentSessionSecret: "student-test-secret",
    students: [student, second].map((value) => ({
      id: value.id,
      firstName: value.name,
      lastName: "",
      email: value.email,
      courseIds: [],
      status: "Active",
    })),
    courses: [
      {
        id: "course",
        title: "Existing course",
        status: "Published",
        price: 1999,
        salePrice: 999,
        thumbnailUrl: "",
      },
    ],
    orders: [],
  };
  const service = new LiveService(
    repo,
    video,
    payments,
    async () => platform,
    () => now,
  );
  const input: ClassInput = {
    title: "Networking workshop",
    description: "A practical class",
    courseId: "course",
    startsAt: "2026-11-19T12:10:00Z",
    timeZone: "Asia/Kolkata",
    durationMinutes: 60,
    capacity: 25,
    price: 29900,
    accessType: "both",
    status: "Scheduled",
  };
  return {
    repo,
    video,
    payments,
    platform,
    service,
    input,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
async function captured(
  f: ReturnType<typeof fixture>,
  classId: string,
  actor = student,
  kind: "class" | "course" = "class",
) {
  const checkout = await f.service.checkout(
    actor,
    classId,
    kind,
    `checkout_${actor.id}_${kind}`,
  );
  assert.ok(checkout.order);
  const payment: VerifiedPayment = {
    id: `pay_${actor.id}${kind}`,
    order_id: checkout.order.providerOrderId!,
    amount: checkout.order.amount,
    currency: "INR",
    status: "captured",
  };
  f.payments.captures.set(payment.id, payment);
  await f.service.verifyPayment(actor, checkout.order.id, payment.id, "valid");
  return { order: checkout.order, payment };
}

test("teacher creates/schedules classes and conflicts, invalid dates, capacity and roles are rejected", async () => {
  const f = fixture();
  const created = await f.service.save(teacher, f.input);
  assert.equal(created.data.status, "Scheduled");
  await assert.rejects(f.service.save(teacher, f.input), /already has a class/);
  await assert.rejects(f.service.save(student, f.input), /teacher/);
  await assert.rejects(f.service.save(teacher, { ...f.input, capacity: 101 }));
  await assert.rejects(f.service.save(teacher, { ...f.input, price: -1 }));
  await assert.rejects(
    f.service.save(teacher, { ...f.input, startsAt: "2020-01-01T00:00:00Z" }),
    /future/,
  );
  await assert.rejects(
    f.service.save(teacher, { ...f.input, timeZone: "Invalid/Zone" }),
    /time zone/,
  );
});
test("drafts are hidden and cannot be joined; unpaid and pre-start join are denied", async () => {
  const f = fixture();
  const draft = await f.service.save(teacher, { ...f.input, status: "Draft" });
  assert.equal((await f.service.list(student)).data.length, 0);
  await assert.rejects(f.service.detail(student, draft.data.id));
  const saved = await f.service.save(teacher, f.input, draft.data.id);
  await assert.rejects(f.service.join(student, saved.data.id), /not live/);
  await f.service.lifecycle(teacher, saved.data.id, "start");
  await assert.rejects(f.service.join(student, saved.data.id), /enrollment/);
});
test("single class capture grants only that class, duplicate callbacks and webhooks do not duplicate access", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, f.input);
  const payment = await captured(f, data.id);
  await f.service.verifyPayment(
    student,
    payment.order.id,
    payment.payment.id,
    "valid",
  );
  assert.equal(f.repo.state.enrollments.length, 1);
  assert.equal(
    (await f.service.detail(student, data.id)).data.accessible,
    true,
  );
  const other = await f.service.save(teacher, {
    ...f.input,
    startsAt: "2026-11-19T14:00:00Z",
  });
  assert.equal(
    (await f.service.detail(student, other.data.id)).data.accessible,
    false,
  );
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-test-secret";
  const raw = JSON.stringify({
    event: "payment.captured",
    created_at: 1,
    payload: { payment: { entity: payment.payment } },
  });
  const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");
  await f.service.paymentWebhook(raw, signature, "event1");
  await f.service.paymentWebhook(raw, signature, "event1");
  await f.service.paymentWebhook(raw, signature, "event2");
  assert.equal(f.repo.state.enrollments.length, 1);
  assert.equal(
    f.repo.state.events.filter((event) => event.type === "payment.captured")
      .length,
    1,
  );
});
test("course purchase unlocks every included session and existing owners never create a duplicate charge", async () => {
  const f = fixture();
  const first = await f.service.save(teacher, f.input);
  const next = await f.service.save(teacher, {
    ...f.input,
    startsAt: "2026-11-19T14:00:00Z",
  });
  await captured(f, first.data.id, student, "course");
  assert.equal(
    (await f.service.detail(student, next.data.id)).data.enrollmentType,
    "course",
  );
  assert.equal(
    (await f.service.checkout(student, next.data.id, "class", "another_key"))
      .alreadyEnrolled,
    true,
  );
  f.platform.students[1]!.courseIds.push("course");
  assert.equal(
    (await f.service.checkout(second, next.data.id, "course", "second_key"))
      .alreadyEnrolled,
    true,
  );
  assert.equal(f.payments.creates, 1);
});
test("failed or pending payment never grants access and cross-student verification is denied", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, f.input);
  const checkout = await f.service.checkout(
    student,
    data.id,
    "class",
    "pending_checkout",
  );
  assert.ok(checkout.order);
  await assert.rejects(
    f.service.verifyPayment(student, checkout.order.id, "pay_bad", "valid"),
  );
  await assert.rejects(
    f.service.verifyPayment(second, checkout.order.id, "pay_bad", "valid"),
    /not found/,
  );
  assert.equal(
    (await f.service.detail(student, data.id)).data.accessible,
    false,
  );
});
test("a timed-out order keeps its stable receipt; concurrent retries resume a single checkout", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, f.input);
  f.payments.failCreate = true;
  await assert.rejects(
    f.service.checkout(student, data.id, "class", "retry_checkout"),
  );
  assert.equal(f.repo.state.orders.length, 1);
  const originalId = f.repo.state.orders[0]!.id;
  f.payments.failCreate = false;
  const [a, b] = await Promise.all([
    f.service.checkout(student, data.id, "class", "retry_checkout"),
    f.service.checkout(student, data.id, "class", "another_checkout"),
  ]);
  assert.equal(a.order?.id, originalId);
  assert.equal(b.order?.id, originalId);
  assert.equal(f.repo.state.orders.length, 1);
});
test("pending checkout reserves the last seat without admitting the unpaid student", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, { ...f.input, capacity: 1 });
  await f.service.checkout(student, data.id, "class", "reserve_seat");
  await assert.rejects(
    f.service.checkout(second, data.id, "class", "second_seat"),
    /reserved/,
  );
  assert.equal(
    (await f.service.detail(student, data.id)).data.accessible,
    false,
  );
});
test("a course checkout reserves every included session and cannot oversell a later full class", async () => {
  const f = fixture();
  const first = await f.service.save(teacher, { ...f.input, capacity: 2 });
  const later = await f.service.save(teacher, {
    ...f.input,
    startsAt: "2026-11-19T14:00:00Z",
    capacity: 1,
  });
  await f.service.checkout(student, first.data.id, "course", "reserve_package");
  await assert.rejects(
    f.service.checkout(second, later.data.id, "class", "later_single"),
    /reserved/,
  );
  await assert.rejects(
    f.service.save(
      teacher,
      {
        ...f.input,
        startsAt: "2026-11-19T14:00:00Z",
        capacity: 1,
        accessType: "individual",
      },
      later.data.id,
    ),
    /after enrollment/,
  );
  const other = fixture();
  const a = await other.service.save(teacher, other.input);
  const b = await other.service.save(teacher, {
    ...other.input,
    startsAt: "2026-11-19T14:00:00Z",
    capacity: 1,
  });
  await captured(other, b.data.id, second);
  await assert.rejects(
    other.service.checkout(student, a.data.id, "course", "full_package"),
    /full/,
  );
});
test("admission, speaking permission, hand, chat moderation, reconnect and attendance", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "free_enrollment");
  await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id);
  assert.equal(JSON.parse(joined.token).canPublish, false);
  await f.service.videoWebhook({
    id: "joined-1",
    event: "participant_joined",
    room: { name: f.repo.state.classes[0]!.roomName! },
    participant: { identity: joined.identity, sid: "sid-1" },
  });
  assert.equal(f.video.calls.at(-1)?.microphone, false);
  await f.service.interaction(student, data.id, {
    action: "hand",
    ticketId: joined.ticketId,
    raised: true,
  });
  await assert.rejects(
    f.service.moderate(student, data.id, {
      action: "permissions",
      identity: joined.identity,
      microphone: true,
    }),
  );
  await f.service.moderate(teacher, data.id, {
    action: "permissions",
    identity: joined.identity,
    microphone: true,
    camera: false,
  });
  const snapshot = await f.service.interaction(student, data.id, {
    action: "chat",
    ticketId: joined.ticketId,
    text: "<script>safe text</script>",
  });
  assert.equal(snapshot.microphone, true);
  assert.equal(snapshot.camera, false);
  assert.equal(snapshot.messages.length, 1);
  await f.service.moderate(teacher, data.id, {
    action: "hide-message",
    messageId: snapshot.messages[0]!.id,
  });
  await f.service.moderate(teacher, data.id, {
    action: "chat",
    enabled: false,
  });
  await assert.rejects(
    f.service.interaction(student, data.id, {
      action: "chat",
      ticketId: joined.ticketId,
      text: "blocked",
    }),
    /paused/,
  );
  f.advance(30000);
  await f.service.interaction(student, data.id, {
    action: "heartbeat",
    ticketId: joined.ticketId,
  });
  await f.service.videoWebhook({
    id: "left-1",
    event: "participant_left",
    room: { name: f.repo.state.classes[0]!.roomName! },
    participant: { identity: joined.identity, sid: "sid-1" },
  });
  assert.equal(f.repo.state.attendance[0]!.durationSeconds, 30);
  const reconnect = await f.service.join(student, data.id);
  assert.notEqual(reconnect.ticketId, joined.ticketId);
  await assert.rejects(
    f.service.interaction(student, data.id, {
      action: "heartbeat",
      ticketId: joined.ticketId,
    }),
    /ended/,
  );
  await f.service.lifecycle(teacher, data.id, "end");
  await assert.rejects(f.service.join(student, data.id), /not live/);
  assert.equal((await f.service.report(teacher, data.id)).completed, 1);
});
test("removed student and replayed/expired join tickets cannot regain SFU permissions", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "free_checkout");
  await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id),
    room = f.repo.state.classes[0]!.roomName!;
  f.advance(31000);
  await f.service.videoWebhook({
    id: "expired",
    event: "participant_joined",
    room: { name: room },
    participant: { identity: joined.identity, sid: "bad" },
  });
  assert.equal(f.video.calls.at(-1)?.action, "remove");
  assert.equal(f.repo.state.attendance.length, 0);
  const fresh = await f.service.join(student, data.id);
  await f.service.videoWebhook({
    id: "fresh",
    event: "participant_joined",
    room: { name: room },
    participant: { identity: fresh.identity, sid: "good" },
  });
  await f.service.moderate(teacher, data.id, {
    action: "remove",
    identity: fresh.identity,
  });
  await assert.rejects(f.service.join(student, data.id), /removed/);
});
test("signed full refunds revoke individual access; duplicate refund entities do not double count", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, f.input);
  const { order, payment } = await captured(f, data.id);
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-test-secret";
  const raw = JSON.stringify({
    event: "refund.processed",
    payload: {
      refund: {
        entity: { id: "rfnd1", payment_id: payment.id, amount: order.amount },
      },
    },
  });
  const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");
  await f.service.paymentWebhook(raw, signature, "refund1");
  await f.service.paymentWebhook(raw, signature, "refund2");
  assert.equal(f.repo.state.orders[0]!.status, "Refunded");
  assert.equal(f.repo.state.orders[0]!.refundedAmount, order.amount);
  assert.equal(
    (await f.service.detail(student, data.id)).data.accessible,
    false,
  );
  await assert.rejects(
    f.service.paymentWebhook(raw, "invalid", "forged"),
    /signature/,
  );
});
test("cancelled classes reject checkout and join; enrolled students receive notifications", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "free_checkout");
  await f.service.lifecycle(teacher, data.id, "cancel");
  await assert.rejects(f.service.join(student, data.id));
  await assert.rejects(
    f.service.checkout(second, data.id, "class", "cancelled_checkout"),
  );
  assert.ok(
    (await f.service.notifications(student)).data.some(
      (value) => value.title === "Class cancelled",
    ),
  );
});
test("Fastify enforces admin/student authentication, input validation and existing health/catalog routes", async () => {
  const f = fixture();
  process.env.ADMIN_SESSION_SECRET = "admin-test-secret";
  process.env.STUDENT_SESSION_SECRET = "student-test-secret";
  const app = buildApp({ liveService: f.service, backgroundJobs: false });
  const token = (payload: object, secret: string) => {
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
  };
  const studentToken = token({ sub: student.id }, "student-test-secret");
  const teacherToken = token(
    { sub: "admin", version: 1, exp: Math.floor(Date.now() / 1000) + 60 },
    "admin-test-secret",
  );
  assert.equal((await app.inject({ url: "/health" })).statusCode, 200);
  assert.equal(
    (await app.inject({ url: "/api/v1/public/courses" })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: "/api/v1/live/classes" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/live/teacher/classes",
        headers: { authorization: `Bearer ${studentToken}` },
      })
    ).statusCode,
    401,
  );
  const saved = await app.inject({
    method: "POST",
    url: "/api/v1/live/teacher/classes",
    headers: { authorization: `Bearer ${teacherToken}` },
    payload: f.input,
  });
  assert.equal(saved.statusCode, 201, saved.body);
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/live/classes",
        headers: { authorization: `Bearer ${studentToken}` },
      })
    ).json().data.length,
    1,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/live/teacher/classes",
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { ...f.input, unexpected: true },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/live/webhooks/razorpay",
        payload: {},
      })
    ).statusCode,
    401,
  );
  const classId = saved.json().data.id;
  assert.equal(
    (
      await app.inject({
        url: `/api/v1/live/teacher/classes/${classId}/students`,
        headers: { authorization: `Bearer ${teacherToken}` },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/v1/live/teacher/classes/${classId}/students`,
        headers: { authorization: `Bearer ${studentToken}` },
      })
    ).statusCode,
    401,
  );
  f.platform.students[0]!.status = "Blocked";
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/live/classes",
        headers: { authorization: `Bearer ${studentToken}` },
      })
    ).statusCode,
    403,
  );
  await app.close();
});
test("real Razorpay adapter rejects frontend-only success, mismatched amounts and invalid HMAC", async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.RAZORPAY_KEY_ID = "key_test";
  process.env.RAZORPAY_KEY_SECRET = "key_secret";
  const original = globalThis.fetch;
  const order: LiveOrder = {
    id: "test",
    studentId: "s",
    kind: "class",
    targetId: "c",
    classId: "c",
    amount: 29900,
    currency: "INR",
    status: "Pending",
    providerOrderId: "order_test",
    paymentId: null,
    idempotencyKey: "test",
    refundedAmount: 0,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  const gateway = new RazorpayGateway();
  try {
    let payment = {
      id: "pay_test",
      order_id: "order_test",
      amount: 29900,
      currency: "INR",
      status: "authorized",
    };
    globalThis.fetch = async () =>
      new Response(JSON.stringify(payment), { status: 200 });
    await assert.rejects(gateway.verify(order, "pay_test", "bad"), /signature/);
    const signature = createHmac("sha256", "key_secret")
      .update("order_test|pay_test")
      .digest("hex");
    await assert.rejects(
      gateway.verify(order, "pay_test", signature),
      /pending/,
    );
    payment = { ...payment, status: "captured", amount: 1 };
    await assert.rejects(gateway.verify(order, "pay_test", signature), /match/);
    payment.amount = 29900;
    assert.equal(
      (await gateway.verify(order, "pay_test", signature)).status,
      "captured",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("real LiveKit JWTs start receive-only; admission rejects tokens after session end", async () => {
  const f = fixture();
  process.env.LIVEKIT_API_KEY = "dev-key";
  process.env.LIVEKIT_API_SECRET = "development-secret-that-is-long-enough";
  process.env.LIVEKIT_URL = "ws://localhost:7880";
  process.env.LIVEKIT_WEBHOOK_ENABLED = "true";
  process.env.LIVEKIT_ADMISSION_ENABLED = "true";
  const real = new LiveKitVideo();
  f.video.token = (ticket, name) => real.token(ticket, name);
  const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "free_checkout");
  await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id);
  const payload = JSON.parse(
    Buffer.from(joined.token.split(".")[1]!, "base64url").toString(),
  );
  assert.equal(payload.video.canPublish, false);
  assert.equal(payload.video.canSubscribe, true);
  assert.equal(payload.video.canPublishData, false);
  assert.ok(payload.exp - payload.nbf <= 30);
  assert.equal((await f.service.admission(joined.token)).allowed, true);
  await f.service.lifecycle(teacher, data.id, "end");
  await assert.rejects(f.service.admission(joined.token));
});
test("an unexpected empty SFU room rotates admission without ending the teacher's class", async () => {
  const f = fixture();
  const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "empty_room_retry");
  await f.service.lifecycle(teacher, data.id, "start");
  const first = await f.service.join(student, data.id);
  const oldRoom = f.repo.state.classes[0]!.roomName!;
  await f.service.videoWebhook({
    id: "empty-room",
    event: "room_finished",
    room: { name: oldRoom },
  });
  assert.equal(f.repo.state.classes[0]!.status, "Live");
  assert.notEqual(f.repo.state.classes[0]!.roomName, oldRoom);
  assert.equal(
    f.repo.state.tickets.find((ticket) => ticket.id === first.ticketId)!
      .revoked,
    true,
  );
  const next = await f.service.join(student, data.id);
  assert.notEqual(next.ticketId, first.ticketId);
  await assert.rejects(
    f.service.interaction(student, data.id, {
      action: "heartbeat",
      ticketId: first.ticketId,
    }),
    /ended/,
  );
});
test("a disabled production Live module preserves existing API startup and health", async () => {
  const nodeEnv = process.env.NODE_ENV,
    databaseUrl = process.env.LIVE_DATABASE_URL;
  process.env.NODE_ENV = "production";
  delete process.env.LIVE_DATABASE_URL;
  const app = buildApp({ backgroundJobs: false });
  try {
    assert.equal(
      (await app.inject({ method: "GET", url: "/health" })).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/v1/live/classes" }))
        .statusCode,
      503,
    );
  } finally {
    await app.close();
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (databaseUrl === undefined) delete process.env.LIVE_DATABASE_URL;
    else process.env.LIVE_DATABASE_URL = databaseUrl;
  }
});
test("LiveKit webhook rejects an unsigned participant event before changing grants", async () => {
  const f = fixture();
  const service = new LiveService(
    f.repo,
    new LiveKitVideo(),
    f.payments,
    async () => f.platform,
  );
  const app = buildApp({ liveService: service, backgroundJobs: false });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/live/webhooks/livekit",
      payload: { event: "participant_joined" },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(f.repo.state.tickets.length, 0);
  } finally {
    await app.close();
  }
});

test("teacher roster includes online/offline enrollment and is private from students and other teachers", async () => {
  const f = fixture(),
    { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "roster_first");
  f.platform.students[1]!.courseIds.push("course");
  const roster = await f.service.students(teacher, data.id);
  assert.deepEqual(roster.data.map((item) => item.id).sort(), [
    student.id,
    second.id,
  ]);
  assert.equal(
    roster.data.every((item) => !item.connected && !item.identity),
    true,
  );
  await assert.rejects(f.service.students(student, data.id), /teacher/);
  await assert.rejects(
    f.service.students({ ...teacher, id: "other" }, data.id),
    /teacher/,
  );
  await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id);
  await f.service.videoWebhook({
    id: "roster-joined",
    event: "participant_joined",
    room: { name: f.repo.state.classes[0]!.roomName! },
    participant: { identity: joined.identity, sid: "roster-sid" },
  });
  assert.equal(
    (await f.service.students(teacher, data.id)).data.find(
      (item) => item.id === student.id,
    )!.connected,
    true,
  );
  assert.equal(
    (
      await f.service.interaction(student, data.id, {
        action: "heartbeat",
        ticketId: joined.ticketId,
      })
    ).students,
    undefined,
  );
  const teacherJoin = await f.service.join(teacher, data.id),
    snapshot = await f.service.interaction(teacher, data.id, {
      action: "heartbeat",
      ticketId: teacherJoin.ticketId,
    });
  assert.equal(snapshot.students?.length, 2);
  assert.equal(
    snapshot.students?.find((item) => item.id === second.id)?.connected,
    false,
  );
});
test("ending one student stops only their attendance/admission while the class and another student continue", async () => {
  const f = fixture(),
    { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  const later = await f.service.save(teacher, {
    ...f.input,
    startsAt: "2026-11-19T14:00:00Z",
    price: 0,
  });
  for (const actor of [student, second])
    await f.service.checkout(actor, data.id, "class", `enroll_end_${actor.id}`);
  await f.service.lifecycle(teacher, data.id, "start");
  const a = await f.service.join(student, data.id),
    b = await f.service.join(second, data.id);
  for (const [index, joined] of [a, b].entries())
    await f.service.videoWebhook({
      id: `end-joined-${index}`,
      event: "participant_joined",
      room: { name: f.repo.state.classes[0]!.roomName! },
      participant: { identity: joined.identity, sid: `end-sid-${index}` },
    });
  await assert.rejects(
    f.service.moderate(student, data.id, {
      action: "end-student-session",
      studentId: second.id,
    }),
    /teacher/,
  );
  await assert.rejects(
    f.service.moderate({ ...teacher, id: "other" }, data.id, {
      action: "end-student-session",
      studentId: student.id,
    }),
    /teacher/,
  );
  await assert.rejects(
    f.service.moderate(teacher, data.id, {
      action: "end-student-session",
      studentId: "not-enrolled",
    }),
    /not enrolled/,
  );
  f.advance(10000);
  await f.service.moderate(teacher, data.id, {
    action: "end-student-session",
    studentId: student.id,
  });
  await f.service.moderate(teacher, data.id, {
    action: "end-student-session",
    studentId: student.id,
  });
  assert.equal(f.repo.state.classes[0]!.status, "Live");
  assert.equal(
    f.repo.state.attendance.find((item) => item.studentId === student.id)!
      .durationSeconds,
    10,
  );
  assert.equal(
    f.repo.state.attendance.find((item) => item.studentId === second.id)!
      .leftAt,
    null,
  );
  await assert.rejects(f.service.join(student, data.id), {
    code: "STUDENT_SESSION_ENDED",
  });
  await assert.rejects(
    f.service.interaction(student, data.id, {
      action: "heartbeat",
      ticketId: a.ticketId,
    }),
    { code: "STUDENT_SESSION_ENDED" },
  );
  assert.equal(
    (
      await f.service.interaction(second, data.id, {
        action: "heartbeat",
        ticketId: b.ticketId,
      })
    ).status,
    "Live",
  );
  const detail = (await f.service.detail(student, data.id)).data;
  assert.equal(detail.accessible, true);
  assert.equal(detail.canJoin, false);
  assert.equal(detail.sessionEnded, true);
  assert.equal(
    (await f.service.detail(student, later.data.id)).data.sessionEnded,
    false,
  );
  assert.equal(
    (await f.service.students(teacher, data.id)).data.find(
      (item) => item.id === student.id,
    )?.sessionEnded,
    true,
  );
  assert.equal(
    f.repo.state.events.filter((item) => item.type === "participant.removed")
      .length,
    1,
  );
});
test("teacher can end an offline enrolled student's session without revoking their course", async () => {
  const f = fixture();
  f.platform.students[0]!.courseIds.push("course");
  const { data } = await f.service.save(teacher, f.input);
  await f.service.lifecycle(teacher, data.id, "start");
  await f.service.moderate(teacher, data.id, {
    action: "end-student-session",
    studentId: student.id,
  });
  await assert.rejects(f.service.join(student, data.id), {
    code: "STUDENT_SESSION_ENDED",
  });
  assert.deepEqual(f.platform.students[0]!.courseIds, ["course"]);
  assert.equal(
    f.video.calls.filter((item) => item.action === "remove").length,
    0,
  );
});
test("failed SFU removal still revokes the student, with cleanup retried by reconciliation", async () => {
  const f = fixture(),
    { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "cleanup_checkout");
  await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id);
  await f.service.videoWebhook({
    id: "cleanup-joined",
    event: "participant_joined",
    room: { name: f.repo.state.classes[0]!.roomName! },
    participant: { identity: joined.identity, sid: "cleanup-sid" },
  });
  const remove = f.video.remove.bind(f.video);
  f.video.remove = async () => {
    throw new Error("SFU unavailable");
  };
  const result = await f.service.moderate(teacher, data.id, {
    action: "end-student-session",
    studentId: student.id,
  });
  assert.equal(result.disconnectPending, true);
  assert.equal(f.repo.state.tickets[0]!.revoked, true);
  assert.ok(f.repo.state.attendance[0]!.leftAt);
  await assert.rejects(f.service.join(student, data.id), {
    code: "STUDENT_SESSION_ENDED",
  });
  f.video.remove = remove;
  await f.service.tick();
  assert.equal(f.repo.state.tickets[0]!.usedSid, null);
});

async function liveRoster(count = 2) {
  const f = fixture();
  const actors = Array.from(
    { length: count },
    (_, index): Actor => ({
      ...student,
      id: `scale-${index}`,
      name: `Student ${index}`,
      email: `scale-${index}@example.test`,
    }),
  );
  f.platform.students = actors.map((actor) => ({
    id: actor.id,
    firstName: actor.name,
    lastName: "",
    email: actor.email,
    status: "Active",
    courseIds: ["course"],
  }));
  const { data } = await f.service.save(teacher, {
    ...f.input,
    capacity: count,
  });
  await f.service.lifecycle(teacher, data.id, "start");
  const join = async (actor: Actor) => {
    const ticket = await f.service.join(actor, data.id);
    await f.service.videoWebhook({
      id: `join-${ticket.ticketId}`,
      event: "participant_joined",
      room: { name: f.repo.state.classes[0]!.roomName! },
      participant: { identity: ticket.identity, sid: `sid-${ticket.ticketId}` },
    });
    return ticket;
  };
  return { ...f, actors, id: data.id, join };
}

test("mute all revokes every student microphone, preserves cameras and the teacher, and retries provider failures", async () => {
  const f = await liveRoster();
  const tickets = await Promise.all(f.actors.map(f.join));
  for (const ticket of tickets)
    await f.service.moderate(teacher, f.id, {
      action: "permissions",
      identity: ticket.identity,
      microphone: true,
      camera: true,
    });
  const original = f.video.permissions.bind(f.video);
  f.video.permissions = async (...args) => {
    if (args[1] === tickets[0]!.identity) throw new Error("temporary outage");
    await original(...args);
  };
  const result = await f.service.moderate(teacher, f.id, {
    action: "mute-all",
  });
  assert.equal((result as { pending: number }).pending, 1);
  assert.ok(
    f.repo.state.tickets.every((ticket) => !ticket.microphone && ticket.camera),
  );
  assert.equal(f.repo.state.classes[0]!.status, "Live");
  f.video.permissions = original;
  await f.service.tick();
  assert.ok(f.repo.state.tickets.every((ticket) => !ticket.mutePending));
  await assert.rejects(
    f.service.moderate(f.actors[0]!, f.id, { action: "mute-all" }),
    /teacher/,
  );
});

test("waiting room is teacher-owned, idempotent, and enforced by admission including joins issued before lock", async () => {
  const f = await liveRoster();
  await f.service.moderate(teacher, f.id, {
    action: "waiting-room",
    enabled: true,
  });
  assert.equal(
    (await f.service.requestEntry(f.actors[0]!, f.id)).status,
    "waiting",
  );
  await f.service.requestEntry(f.actors[0]!, f.id);
  assert.equal(
    (await f.service.students(teacher, f.id)).admission.waiting.length,
    1,
  );
  await assert.rejects(f.service.join(f.actors[0]!, f.id), /approval/);
  await assert.rejects(
    f.service.moderate(f.actors[1]!, f.id, {
      action: "admit-student",
      studentId: f.actors[0]!.id,
    }),
    /teacher/,
  );
  await f.service.moderate(teacher, f.id, {
    action: "admit-student",
    studentId: f.actors[0]!.id,
  });
  assert.equal(
    (await f.service.requestEntry(f.actors[0]!, f.id)).status,
    "allowed",
  );
  const issued = await f.service.join(f.actors[0]!, f.id);
  await f.service.moderate(teacher, f.id, { action: "lock", enabled: true });
  await f.service.videoWebhook({
    id: "locked-late-join",
    event: "participant_joined",
    room: { name: f.repo.state.classes[0]!.roomName! },
    participant: { identity: issued.identity, sid: "late" },
  });
  assert.ok(
    f.video.calls.some(
      (call) => call.action === "remove" && call.identity === issued.identity,
    ),
  );
  assert.equal(f.repo.state.attendance.length, 0);
  await assert.rejects(f.service.join(f.actors[0]!, f.id), /locked/);
  await f.service.moderate(teacher, f.id, { action: "lock", enabled: false });
  await f.join(f.actors[0]!);
  await f.service.moderate(teacher, f.id, { action: "lock", enabled: true });
  assert.equal(
    (await f.service.requestEntry(f.actors[0]!, f.id)).status,
    "allowed",
  );
  await f.service.join(f.actors[0]!, f.id);
});

test("declined or cancelled waiting requests cannot bypass teacher decisions or entitlement", async () => {
  const f = await liveRoster();
  await f.service.moderate(teacher, f.id, {
    action: "waiting-room",
    enabled: true,
  });
  await f.service.requestEntry(f.actors[0]!, f.id);
  await f.service.requestEntry(f.actors[0]!, f.id, true);
  assert.equal(
    (await f.service.students(teacher, f.id)).admission.waiting.length,
    0,
  );
  await f.service.requestEntry(f.actors[0]!, f.id);
  await f.service.moderate(teacher, f.id, {
    action: "deny-student",
    studentId: f.actors[0]!.id,
  });
  assert.equal(
    (await f.service.requestEntry(f.actors[0]!, f.id)).status,
    "denied",
  );
  await assert.rejects(f.service.join(f.actors[0]!, f.id), /declined/);
  f.platform.students[1]!.courseIds = [];
  await assert.rejects(
    f.service.requestEntry(f.actors[1]!, f.id),
    /enrollment/,
  );
});

for (const count of [10, 25, 50])
  test(`${count} distinct students retain isolated roster, permissions, chat and attendance under concurrent control traffic (mock SFU)`, async () => {
    const f = await liveRoster(count);
    const tickets = await Promise.all(f.actors.map(f.join));
    assert.equal(
      (await f.service.students(teacher, f.id)).data.filter(
        (student) => student.connected,
      ).length,
      count,
    );
    await Promise.all(
      tickets.map((ticket, index) =>
        f.service.interaction(f.actors[index]!, f.id, {
          action: "hand",
          ticketId: ticket.ticketId,
          raised: true,
        }),
      ),
    );
    await f.service.moderate(teacher, f.id, { action: "mute-all" });
    await f.service.moderate(teacher, f.id, {
      action: "end-student-session",
      studentId: f.actors[0]!.id,
    });
    const heartbeats = await Promise.all(
      tickets
        .slice(1)
        .map((ticket, index) =>
          f.service.interaction(f.actors[index + 1]!, f.id, {
            action: "heartbeat",
            ticketId: ticket.ticketId,
          }),
        ),
    );
    assert.ok(
      heartbeats.every(
        (snapshot) =>
          !snapshot.students &&
          !snapshot.admission &&
          snapshot.participants.length === count - 1,
      ),
    );
    await assert.rejects(f.service.join(f.actors[0]!, f.id), /ended/);
    assert.equal(
      f.repo.state.attendance.filter((record) => !record.leftAt).length,
      count - 1,
    );
    assert.equal(f.repo.state.classes[0]!.status, "Live");
  });

test("recording metadata is writable only by its teacher and downloadable only with current entitlement", async () => {
  const f = await liveRoster();
  const file = {
    id: "c4338eec-4c09-4fa7-94ac-84718d3df434",
    mime: "video/webm" as const,
    bytes: 100,
    createdAt: new Date().toISOString(),
  };
  await assert.rejects(
    f.service.attachRecording(f.actors[0]!, f.id, file),
    /teacher/,
  );
  await f.service.attachRecording(teacher, f.id, file);
  assert.equal(
    (await f.service.recordingAccess(f.actors[0]!, f.id))?.id,
    file.id,
  );
  f.platform.students[0]!.courseIds = [];
  await assert.rejects(
    f.service.recordingAccess(f.actors[0]!, f.id),
    /Enrollment/,
  );
  await assert.rejects(
    f.service.recordingAccess({ ...teacher, id: "other" }, f.id),
    /teacher/,
  );
  const ticket = await f.join(f.actors[1]!);
  await f.service.moderate(teacher, f.id, {
    action: "recording",
    enabled: true,
  });
  const pulse = () =>
    f.service.interaction(f.actors[1]!, f.id, {
      action: "heartbeat",
      ticketId: ticket.ticketId,
    });
  assert.equal((await pulse()).recordingActive, true);
  f.advance(16000);
  assert.equal((await pulse()).recordingActive, false);
});

test("private recording HTTP upload/download enforces entitlement, validates media and cleans oversized files", async () => {
  const f = await liveRoster(),
    root = await mkdtemp(joinPath(tmpdir(), "tutor-recording-test-")),
    files = new RecordingFiles(root),
    app = Fastify();
  const token = (payload: object, secret: string) => {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
  };
  const prior = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "recording-test-admin";
  const admin = token(
    { sub: "admin", version: 1, exp: Math.floor(Date.now() / 1000) + 600 },
    process.env.ADMIN_SESSION_SECRET,
  );
  const learner = token(
    { sub: f.actors[0]!.id },
    process.env.STUDENT_SESSION_SECRET ?? f.platform.studentSessionSecret,
  );
  await app.register(liveRoutes, {
    prefix: "/live",
    service: f.service,
    recordings: files,
    backgroundJobs: false,
  });
  const upload = `/live/teacher/classes/${f.id}/recording`,
    download = `/live/classes/${f.id}/recording`,
    bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
  try {
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: upload,
          headers: { "content-type": "video/webm" },
          payload: bytes,
        })
      ).statusCode,
      401,
    );
    const saved = await app.inject({
      method: "POST",
      url: upload,
      headers: {
        authorization: `Bearer ${admin}`,
        "content-type": "video/webm",
      },
      payload: bytes,
    });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal((await app.inject({ url: download })).statusCode, 401);
    const file = await app.inject({
      url: download,
      headers: { authorization: `Bearer ${learner}` },
    });
    assert.equal(file.statusCode, 200, file.body);
    assert.deepEqual(file.rawPayload, bytes);
    assert.equal(file.headers["cache-control"], "private, no-store");
    assert.match(String(file.headers["content-disposition"]), /attachment/);
    f.platform.students[0]!.courseIds = [];
    assert.equal(
      (
        await app.inject({
          url: download,
          headers: { authorization: `Bearer ${learner}` },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: upload,
          headers: {
            authorization: `Bearer ${admin}`,
            "content-type": "video/webm",
          },
          payload: Buffer.from("not a recording"),
        })
      ).statusCode,
      400,
    );
    const count = (await readdir(root)).length,
      chunk = Buffer.alloc(8 * 1024 * 1024);
    await assert.rejects(
      files.save(
        Readable.from(
          (async function* () {
            for (let i = 0; i < 13; i++) yield chunk;
          })(),
        ),
        "video/webm",
      ),
      /100 MB/,
    );
    assert.equal((await readdir(root)).length, count);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
    if (prior === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prior;
  }
});
