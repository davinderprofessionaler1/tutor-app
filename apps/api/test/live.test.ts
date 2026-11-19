import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { LiveService, type ClassInput } from "../src/live/service.js";
import { emptyLiveState, type Actor, type JoinTicket, type LiveOrder, type LiveRepository, type LiveState, type Platform } from "../src/live/types.js";
import { LiveKitVideo, RazorpayGateway, type ClassroomVideo, type PaymentGateway, type VerifiedPayment } from "../src/live/providers.js";
import { buildApp } from "../src/app.js";

class MemoryRepository implements LiveRepository {
  state = emptyLiveState();
  private queue: Promise<unknown> = Promise.resolve();
  transaction<T>(work: (state: LiveState) => T | Promise<T>): Promise<T> {
    const result = this.queue.then(async () => { const state = structuredClone(this.state); const value = await work(state); this.state = state; return structuredClone(value); });
    this.queue = result.catch(() => undefined); return result;
  }
}
class FakeVideo implements ClassroomVideo {
  calls: { action: string; identity?: string; microphone?: boolean; camera?: boolean }[] = [];
  configured() { return true; }
  async createRoom() { this.calls.push({ action: "create" }); }
  async deleteRoom() { this.calls.push({ action: "delete" }); }
  async token(ticket: JoinTicket) { return JSON.stringify({ identity: ticket.identity, canPublish: false, canSubscribe: false }); }
  async permissions(_room: string, identity: string, _role: string, microphone: boolean, camera: boolean) { this.calls.push({ action: "permissions", identity, microphone, camera }); }
  async remove(_room: string, identity: string) { this.calls.push({ action: "remove", identity }); }
}
class FakePayments implements PaymentGateway {
  captures = new Map<string, VerifiedPayment>();
  creates = 0; failCreate = false;
  configured() { return true; }
  async create(order: LiveOrder) { this.creates++; if (this.failCreate) throw new Error("Network timeout"); return `order_${order.id}`; }
  async verify(order: LiveOrder, id: string, signature?: string) {
    const payment = this.captures.get(id);
    assert.ok(signature === undefined || signature === "valid", "invalid signature");
    assert.ok(payment && payment.status === "captured" && payment.order_id === order.providerOrderId && payment.amount === order.amount && payment.currency === order.currency, "payment not captured or mismatched");
    return payment;
  }
  async refund() {}
}
const teacher: Actor = { id: "teacher@example.test", role: "teacher", name: "Teacher", email: "teacher@example.test", courseIds: [] };
const student: Actor = { id: "s1", role: "student", name: "Student One", email: "one@example.test", courseIds: [] };
const second: Actor = { ...student, id: "s2", name: "Student Two", email: "two@example.test" };
function fixture() {
  const repo = new MemoryRepository(), video = new FakeVideo(), payments = new FakePayments();
  let now = Date.parse("2026-11-19T12:00:00Z");
  const platform: Platform = { profile: { firstName: "Teacher", lastName: "One", email: teacher.id, role: "Super Admin" }, sessionVersion: 1, studentSessionSecret: "student-test-secret", students: [student, second].map((value) => ({ id: value.id, firstName: value.name, lastName: "", email: value.email, courseIds: [], status: "Active" })), courses: [{ id: "course", title: "Existing course", status: "Published", price: 1999, salePrice: 999, thumbnailUrl: "" }], orders: [] };
  const service = new LiveService(repo, video, payments, async () => platform, () => now);
  const input: ClassInput = { title: "Networking workshop", description: "A practical class", courseId: "course", startsAt: "2026-11-19T12:10:00Z", timeZone: "Asia/Kolkata", durationMinutes: 60, capacity: 25, price: 29900, accessType: "both", status: "Scheduled" };
  return { repo, video, payments, platform, service, input, advance: (ms: number) => { now += ms; } };
}
async function captured(f: ReturnType<typeof fixture>, classId: string, actor = student, kind: "class" | "course" = "class") {
  const checkout = await f.service.checkout(actor, classId, kind, `checkout_${actor.id}_${kind}`);
  assert.ok(checkout.order);
  const payment: VerifiedPayment = { id: `pay_${actor.id}${kind}`, order_id: checkout.order.providerOrderId!, amount: checkout.order.amount, currency: "INR", status: "captured" };
  f.payments.captures.set(payment.id, payment);
  await f.service.verifyPayment(actor, checkout.order.id, payment.id, "valid");
  return { order: checkout.order, payment };
}

test("teacher creates/schedules classes and conflicts, invalid dates, capacity and roles are rejected", async () => {
  const f = fixture(); const created = await f.service.save(teacher, f.input); assert.equal(created.data.status, "Scheduled");
  await assert.rejects(f.service.save(teacher, f.input), /already has a class/);
  await assert.rejects(f.service.save(student, f.input), /teacher/);
  await assert.rejects(f.service.save(teacher, { ...f.input, capacity: 101 }));
  await assert.rejects(f.service.save(teacher, { ...f.input, price: -1 }));
  await assert.rejects(f.service.save(teacher, { ...f.input, startsAt: "2020-01-01T00:00:00Z" }), /future/);
  await assert.rejects(f.service.save(teacher, { ...f.input, timeZone: "Invalid/Zone" }), /time zone/);
});
test("drafts are hidden and cannot be joined; unpaid and pre-start join are denied", async () => {
  const f = fixture(); const draft = await f.service.save(teacher, { ...f.input, status: "Draft" });
  assert.equal((await f.service.list(student)).data.length, 0);
  await assert.rejects(f.service.detail(student, draft.data.id));
  const saved = await f.service.save(teacher, f.input, draft.data.id);
  await assert.rejects(f.service.join(student, saved.data.id), /not live/);
  await f.service.lifecycle(teacher, saved.data.id, "start");
  await assert.rejects(f.service.join(student, saved.data.id), /enrollment/);
});
test("single class capture grants only that class, duplicate callbacks and webhooks do not duplicate access", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, f.input);
  const payment = await captured(f, data.id);
  await f.service.verifyPayment(student, payment.order.id, payment.payment.id, "valid");
  assert.equal(f.repo.state.enrollments.length, 1);
  assert.equal((await f.service.detail(student, data.id)).data.accessible, true);
  const other = await f.service.save(teacher, { ...f.input, startsAt: "2026-11-19T14:00:00Z" });
  assert.equal((await f.service.detail(student, other.data.id)).data.accessible, false);
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-test-secret";
  const raw = JSON.stringify({ event: "payment.captured", created_at: 1, payload: { payment: { entity: payment.payment } } });
  const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  await f.service.paymentWebhook(raw, signature, "event1"); await f.service.paymentWebhook(raw, signature, "event1"); await f.service.paymentWebhook(raw, signature, "event2");
  assert.equal(f.repo.state.enrollments.length, 1);
  assert.equal(f.repo.state.events.filter((event) => event.type === "payment.captured").length, 1);
});
test("course purchase unlocks every included session and existing owners never create a duplicate charge", async () => {
  const f = fixture(); const first = await f.service.save(teacher, f.input);
  const next = await f.service.save(teacher, { ...f.input, startsAt: "2026-11-19T14:00:00Z" });
  await captured(f, first.data.id, student, "course");
  assert.equal((await f.service.detail(student, next.data.id)).data.enrollmentType, "course");
  assert.equal((await f.service.checkout(student, next.data.id, "class", "another_key")).alreadyEnrolled, true);
  f.platform.students[1]!.courseIds.push("course");
  assert.equal((await f.service.checkout(second, next.data.id, "course", "second_key")).alreadyEnrolled, true);
  assert.equal(f.payments.creates, 1);
});
test("failed or pending payment never grants access and cross-student verification is denied", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, f.input);
  const checkout = await f.service.checkout(student, data.id, "class", "pending_checkout"); assert.ok(checkout.order);
  await assert.rejects(f.service.verifyPayment(student, checkout.order.id, "pay_bad", "valid"));
  await assert.rejects(f.service.verifyPayment(second, checkout.order.id, "pay_bad", "valid"), /not found/);
  assert.equal((await f.service.detail(student, data.id)).data.accessible, false);
});
test("a timed-out order keeps its stable receipt; concurrent retries resume a single checkout", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, f.input);
  f.payments.failCreate = true; await assert.rejects(f.service.checkout(student, data.id, "class", "retry_checkout"));
  assert.equal(f.repo.state.orders.length, 1); const originalId = f.repo.state.orders[0]!.id;
  f.payments.failCreate = false;
  const [a, b] = await Promise.all([f.service.checkout(student, data.id, "class", "retry_checkout"), f.service.checkout(student, data.id, "class", "another_checkout")]);
  assert.equal(a.order?.id, originalId); assert.equal(b.order?.id, originalId); assert.equal(f.repo.state.orders.length, 1);
});
test("pending checkout reserves the last seat without admitting the unpaid student", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, { ...f.input, capacity: 1 });
  await f.service.checkout(student, data.id, "class", "reserve_seat");
  await assert.rejects(f.service.checkout(second, data.id, "class", "second_seat"), /reserved/);
  assert.equal((await f.service.detail(student, data.id)).data.accessible, false);
});
test("admission, speaking permission, hand, chat moderation, reconnect and attendance", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "free_enrollment"); await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id);
  assert.equal(JSON.parse(joined.token).canPublish, false);
  await f.service.videoWebhook({ id: "joined-1", event: "participant_joined", room: { name: f.repo.state.classes[0]!.roomName! }, participant: { identity: joined.identity, sid: "sid-1" } });
  assert.equal(f.video.calls.at(-1)?.microphone, false);
  await f.service.interaction(student, data.id, { action: "hand", ticketId: joined.ticketId, raised: true });
  await assert.rejects(f.service.moderate(student, data.id, { action: "permissions", identity: joined.identity, microphone: true }));
  await f.service.moderate(teacher, data.id, { action: "permissions", identity: joined.identity, microphone: true, camera: false });
  const snapshot = await f.service.interaction(student, data.id, { action: "chat", ticketId: joined.ticketId, text: "<script>safe text</script>" });
  assert.equal(snapshot.microphone, true); assert.equal(snapshot.camera, false); assert.equal(snapshot.messages.length, 1);
  await f.service.moderate(teacher, data.id, { action: "hide-message", messageId: snapshot.messages[0]!.id });
  await f.service.moderate(teacher, data.id, { action: "chat", enabled: false });
  await assert.rejects(f.service.interaction(student, data.id, { action: "chat", ticketId: joined.ticketId, text: "blocked" }), /paused/);
  f.advance(30000); await f.service.interaction(student, data.id, { action: "heartbeat", ticketId: joined.ticketId });
  await f.service.videoWebhook({ id: "left-1", event: "participant_left", room: { name: f.repo.state.classes[0]!.roomName! }, participant: { identity: joined.identity, sid: "sid-1" } });
  assert.equal(f.repo.state.attendance[0]!.durationSeconds, 30);
  const reconnect = await f.service.join(student, data.id); assert.notEqual(reconnect.ticketId, joined.ticketId);
  await assert.rejects(f.service.interaction(student, data.id, { action: "heartbeat", ticketId: joined.ticketId }), /ended/);
  await f.service.lifecycle(teacher, data.id, "end");
  await assert.rejects(f.service.join(student, data.id), /not live/);
  assert.equal((await f.service.report(teacher, data.id)).completed, 1);
});
test("removed student and replayed/expired join tickets cannot regain SFU permissions", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "free_checkout"); await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id), room = f.repo.state.classes[0]!.roomName!;
  f.advance(31000);
  await f.service.videoWebhook({ id: "expired", event: "participant_joined", room: { name: room }, participant: { identity: joined.identity, sid: "bad" } });
  assert.equal(f.video.calls.at(-1)?.action, "remove"); assert.equal(f.repo.state.attendance.length, 0);
  const fresh = await f.service.join(student, data.id);
  await f.service.videoWebhook({ id: "fresh", event: "participant_joined", room: { name: room }, participant: { identity: fresh.identity, sid: "good" } });
  await f.service.moderate(teacher, data.id, { action: "remove", identity: fresh.identity });
  await assert.rejects(f.service.join(student, data.id), /removed/);
});
test("signed full refunds revoke individual access; duplicate refund entities do not double count", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, f.input); const { order, payment } = await captured(f, data.id);
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-test-secret";
  const raw = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd1", payment_id: payment.id, amount: order.amount } } } });
  const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  await f.service.paymentWebhook(raw, signature, "refund1"); await f.service.paymentWebhook(raw, signature, "refund2");
  assert.equal(f.repo.state.orders[0]!.status, "Refunded"); assert.equal(f.repo.state.orders[0]!.refundedAmount, order.amount);
  assert.equal((await f.service.detail(student, data.id)).data.accessible, false);
  await assert.rejects(f.service.paymentWebhook(raw, "invalid", "forged"), /signature/);
});
test("cancelled classes reject checkout and join; enrolled students receive notifications", async () => {
  const f = fixture(); const { data } = await f.service.save(teacher, { ...f.input, price: 0 });
  await f.service.checkout(student, data.id, "class", "free_checkout"); await f.service.lifecycle(teacher, data.id, "cancel");
  await assert.rejects(f.service.join(student, data.id)); await assert.rejects(f.service.checkout(second, data.id, "class", "cancelled_checkout"));
  assert.ok((await f.service.notifications(student)).data.some((value) => value.title === "Class cancelled"));
});
test("Fastify enforces admin/student authentication, input validation and existing health/catalog routes", async () => {
  const f = fixture(); process.env.ADMIN_SESSION_SECRET = "admin-test-secret"; process.env.STUDENT_SESSION_SECRET = "student-test-secret";
  const app = buildApp({ liveService: f.service, backgroundJobs: false });
  const token = (payload: object, secret: string) => { const data = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`; };
  const studentToken = token({ sub: student.id }, "student-test-secret");
  const teacherToken = token({ sub: "admin", version: 1, exp: Math.floor(Date.now() / 1000) + 60 }, "admin-test-secret");
  assert.equal((await app.inject({ url: "/health" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/v1/public/courses" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/v1/live/classes" })).statusCode, 401);
  assert.equal((await app.inject({ url: "/api/v1/live/teacher/classes", headers: { authorization: `Bearer ${studentToken}` } })).statusCode, 401);
  const saved = await app.inject({ method: "POST", url: "/api/v1/live/teacher/classes", headers: { authorization: `Bearer ${teacherToken}` }, payload: f.input }); assert.equal(saved.statusCode, 201, saved.body);
  assert.equal((await app.inject({ url: "/api/v1/live/classes", headers: { authorization: `Bearer ${studentToken}` } })).json().data.length, 1);
  assert.equal((await app.inject({ method: "POST", url: "/api/v1/live/teacher/classes", headers: { authorization: `Bearer ${teacherToken}` }, payload: { ...f.input, unexpected: true } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/api/v1/live/webhooks/razorpay", payload: {} })).statusCode, 401);
  f.platform.students[0]!.status = "Blocked";
  assert.equal((await app.inject({ url: "/api/v1/live/classes", headers: { authorization: `Bearer ${studentToken}` } })).statusCode, 403);
  await app.close();
});
test("real Razorpay adapter rejects frontend-only success, mismatched amounts and invalid HMAC", async () => {
  process.env.RAZORPAY_KEY_ID = "key_test"; process.env.RAZORPAY_KEY_SECRET = "key_secret";
  const original = globalThis.fetch;
  const order: LiveOrder = { id: "test", studentId: "s", kind: "class", targetId: "c", classId: "c", amount: 29900, currency: "INR", status: "Pending", providerOrderId: "order_test", paymentId: null, idempotencyKey: "test", refundedAmount: 0, createdAt: new Date().toISOString(), paidAt: null };
  const gateway = new RazorpayGateway();
  try {
    let payment = { id: "pay_test", order_id: "order_test", amount: 29900, currency: "INR", status: "authorized" };
    globalThis.fetch = async () => new Response(JSON.stringify(payment), { status: 200 });
    await assert.rejects(gateway.verify(order, "pay_test", "bad"), /signature/);
    const signature = createHmac("sha256", "key_secret").update("order_test|pay_test").digest("hex");
    await assert.rejects(gateway.verify(order, "pay_test", signature), /pending/);
    payment = { ...payment, status: "captured", amount: 1 }; await assert.rejects(gateway.verify(order, "pay_test", signature), /match/);
    payment.amount = 29900; assert.equal((await gateway.verify(order, "pay_test", signature)).status, "captured");
  } finally { globalThis.fetch = original; }
});
test("real LiveKit JWTs start without media grants; admission rejects tokens after session end", async () => {
  const f = fixture(); process.env.LIVEKIT_API_KEY = "dev-key"; process.env.LIVEKIT_API_SECRET = "development-secret-that-is-long-enough";
  process.env.LIVEKIT_URL = "ws://localhost:7880"; process.env.LIVEKIT_WEBHOOK_ENABLED = "true"; process.env.LIVEKIT_ADMISSION_ENABLED = "true";
  const real = new LiveKitVideo(); f.video.token = (ticket, name) => real.token(ticket, name);
  const { data } = await f.service.save(teacher, { ...f.input, price: 0 }); await f.service.checkout(student, data.id, "class", "free_checkout"); await f.service.lifecycle(teacher, data.id, "start");
  const joined = await f.service.join(student, data.id); const payload = JSON.parse(Buffer.from(joined.token.split(".")[1]!, "base64url").toString());
  assert.equal(payload.video.canPublish, false); assert.equal(payload.video.canSubscribe, false); assert.equal(payload.video.canPublishData, false); assert.ok(payload.exp - payload.nbf <= 30);
  assert.equal((await f.service.admission(joined.token)).allowed, true);
  await f.service.lifecycle(teacher, data.id, "end"); await assert.rejects(f.service.admission(joined.token));
});
