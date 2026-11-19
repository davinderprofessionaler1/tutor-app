import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { TokenVerifier, TrackSource } from "livekit-server-sdk";
import { safeEqual } from "./auth.js";
import { LiveKitVideo, RazorpayGateway, type ClassroomVideo, type PaymentGateway } from "./providers.js";
import { liveRepository, readPlatform } from "./store.js";
import { LiveError, type Actor, type JoinTicket, type LiveClass, type LiveOrder, type LiveRepository, type LiveState, type Platform } from "./types.js";

const inputSchema = z.object({
  title: z.string().trim().min(3).max(160), description: z.string().trim().max(5000), objectives: z.string().trim().max(3000).default(""), instructions: z.string().trim().max(3000).default(""),
  courseId: z.string().max(200).nullable().default(null), thumbnailUrl: z.string().max(2000).default(""),
  startsAt: z.iso.datetime(), timeZone: z.string().min(1).max(80), durationMinutes: z.number().int().min(5).max(480), capacity: z.number().int().min(1).max(100),
  price: z.number().int().min(0).max(100_000_000), enrollmentDeadline: z.iso.datetime().nullable().default(null),
  accessType: z.enum(["individual", "course", "both"]), status: z.enum(["Draft", "Scheduled"]),
}).strict();
export type ClassInput = z.input<typeof inputSchema>;
export type VideoEvent = { id: string; event: string; createdAt?: number | bigint; room?: { name: string }; participant?: { identity: string; sid: string } };

export class LiveService {
  constructor(
    public repository: LiveRepository = liveRepository(), public video: ClassroomVideo = new LiveKitVideo(),
    public payments: PaymentGateway = new RazorpayGateway(), public platform: () => Promise<Platform> = readPlatform,
    public clock: () => number = Date.now,
  ) {}
  private now() { return new Date(this.clock()).toISOString(); }
  private event(state: LiveState, actorId: string, type: string, classId: string | null, detail = "") {
    state.events.push({ id: randomUUID(), actorId, type, classId, detail, createdAt: this.now() });
  }
  private get(state: LiveState, id: string) {
    const value = state.classes.find((item) => item.id === id);
    if (!value) throw new LiveError(404, "Live class not found.");
    return value;
  }
  private teacher(actor: Actor, value?: LiveClass) {
    if (actor.role !== "teacher" || (value && value.teacherId !== actor.id)) throw new LiveError(403, "Only the class teacher can perform this action.");
  }
  private ownsCourse(state: LiveState, platform: Platform, studentId: string, courseId: string) {
    const student = platform.students.find((item) => item.id === studentId && item.status === "Active");
    if (!student) return false;
    return student.courseIds.includes(courseId) || state.orders.some((order) => order.studentId === studentId && order.kind === "course" && order.targetId === courseId && order.status === "Paid");
  }
  private access(state: LiveState, platform: Platform, studentId: string, value: LiveClass): "course" | "individual" | null {
    if (!platform.students.some((student) => student.id === studentId && student.status === "Active")) return null;
    if (value.accessType !== "individual" && value.courseId && this.ownsCourse(state, platform, studentId, value.courseId)) return "course";
    const enrollment = state.enrollments.find((item) => item.classId === value.id && item.studentId === studentId && item.status === "Active");
    if (enrollment && (!enrollment.orderId || state.orders.some((order) => order.id === enrollment.orderId && order.status === "Paid"))) return "individual";
    return null;
  }
  private enrolled(state: LiveState, platform: Platform, value: LiveClass) { return platform.students.filter((student) => this.access(state, platform, student.id, value)); }
  private notify(state: LiveState, platform: Platform, value: LiveClass, title: string, body: string) {
    for (const student of this.enrolled(state, platform, value)) state.notifications.push({ id: randomUUID(), classId: value.id, studentId: student.id, title, body, createdAt: this.now(), read: false, emailSentAt: null });
  }
  private view(state: LiveState, platform: Platform, actor: Actor, value: LiveClass) {
    const source = actor.role === "student" ? this.access(state, platform, actor.id, value) : null;
    const count = this.enrolled(state, platform, value).length;
    const course = platform.courses.find((item) => item.id === value.courseId);
    const paid = state.orders.filter((order) => order.classId === value.id && order.status === "Paid");
    return { ...value, roomName: undefined, courseTitle: course?.title ?? "", coursePrice: course ? Math.round((course.salePrice ?? course.price) * 100) : 0,
      enrollmentCount: count, availableSeats: Math.max(0, value.capacity - count), accessible: actor.role === "teacher" || Boolean(source), enrollmentType: source,
      canJoin: Boolean(source && value.status === "Live"), paymentStatus: source ? "Enrolled" : "Not enrolled",
      ...(actor.role === "teacher" ? { revenue: paid.reduce((sum, order) => sum + order.amount, 0) } : {}),
    };
  }
  async list(actor: Actor, courseId?: string) {
    const platform = await this.platform();
    return this.repository.transaction((state) => {
      const values = state.classes.filter((value) => (!courseId || value.courseId === courseId) && (actor.role === "teacher" ? value.teacherId === actor.id : value.status !== "Draft"));
      return { data: values.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((value) => this.view(state, platform, actor, value)),
        courses: actor.role === "teacher" ? platform.courses.filter((course) => course.status === "Published") : undefined,
        teacher: actor.role === "teacher" ? { name: actor.name, id: actor.id } : undefined,
        infrastructure: { videoConfigured: this.video.configured(), paymentsConfigured: this.payments.configured() },
      };
    });
  }
  async detail(actor: Actor, id: string) {
    const platform = await this.platform();
    return this.repository.transaction((state) => {
      const value = this.get(state, id);
      if (actor.role === "teacher") this.teacher(actor, value);
      else if (value.status === "Draft") throw new LiveError(404, "Live class not found.");
      return { data: this.view(state, platform, actor, value) };
    });
  }
  async save(actor: Actor, input: unknown, id?: string) {
    this.teacher(actor);
    const data = inputSchema.parse(input);
    const platform = await this.platform();
    try { new Intl.DateTimeFormat("en", { timeZone: data.timeZone }).format(); } catch { throw new LiveError(400, "Choose a valid IANA time zone."); }
    if (data.thumbnailUrl && !/^https:\/\//.test(data.thumbnailUrl) && !data.thumbnailUrl.startsWith("/uploads/thumbnails/")) throw new LiveError(400, "Use an HTTPS thumbnail or an uploaded course thumbnail.");
    if (data.courseId && !platform.courses.some((course) => course.id === data.courseId && course.status === "Published")) throw new LiveError(400, "Select a published course.");
    if (data.accessType !== "individual" && !data.courseId) throw new LiveError(400, "Course access requires an associated course.");
    if (Date.parse(data.startsAt) <= this.clock()) throw new LiveError(400, "Schedule the class in the future.");
    if (data.enrollmentDeadline && (Date.parse(data.enrollmentDeadline) > Date.parse(data.startsAt) || Date.parse(data.enrollmentDeadline) <= this.clock())) throw new LiveError(400, "Enrollment deadline must be in the future and before the class.");
    return this.repository.transaction((state) => {
      const old = id ? this.get(state, id) : undefined;
      if (old) {
        this.teacher(actor, old);
        if (!["Draft", "Scheduled"].includes(old.status)) throw new LiveError(409, "Only draft or scheduled classes can be edited.");
        if ((this.enrolled(state, platform, old).length || state.orders.some((order) => order.classId === old.id && ["Pending", "Paid"].includes(order.status))) && (old.price !== data.price || old.accessType !== data.accessType || old.courseId !== data.courseId)) throw new LiveError(409, "Access and pricing cannot change after enrollment or checkout. Create another class instead.");
        if (data.capacity < this.enrolled(state, platform, old).length) throw new LiveError(409, "Capacity cannot be below current enrollment.");
      }
      if (data.status === "Scheduled" && state.classes.some((value) => value.id !== id && value.teacherId === actor.id && ["Scheduled", "Live"].includes(value.status) && Date.parse(value.startsAt) < Date.parse(data.startsAt) + data.durationMinutes * 60000 && Date.parse(value.startsAt) + value.durationMinutes * 60000 > Date.parse(data.startsAt))) throw new LiveError(409, "This teacher already has a class during that time.");
      const value: LiveClass = { id: old?.id ?? randomUUID(), ...data, teacherId: actor.id, teacherName: actor.name, roomName: null, startedAt: null, endedAt: null, chatEnabled: true, createdAt: old?.createdAt ?? this.now(), updatedAt: this.now() };
      if (old) Object.assign(old, value); else state.classes.push(value);
      this.event(state, actor.id, old ? "class.updated" : "class.created", value.id);
      if (old) this.notify(state, platform, value, "Class rescheduled", `${value.title} is scheduled for ${value.startsAt}.`);
      return { data: this.view(state, platform, actor, value) };
    });
  }
  async lifecycle(actor: Actor, id: string, action: "start" | "end" | "cancel") {
    const platform = await this.platform();
    return this.repository.transaction(async (state) => {
      const value = this.get(state, id); this.teacher(actor, value);
      if (action === "start") {
        if (value.status === "Live") return { data: this.view(state, platform, actor, value) };
        if (value.status !== "Scheduled") throw new LiveError(409, "Schedule this class before starting it.");
        if (this.clock() < Date.parse(value.startsAt) - 15 * 60000) throw new LiveError(409, "You can start the classroom up to 15 minutes before its scheduled time.");
        if (this.clock() > Date.parse(value.startsAt) + value.durationMinutes * 60000) throw new LiveError(409, "This class schedule has elapsed. Reschedule it first.");
        const roomName = `class-${value.id}-${randomUUID()}`;
        await this.video.createRoom(roomName, value.capacity);
        value.roomName = roomName; value.status = "Live"; value.startedAt = this.now();
        this.notify(state, platform, value, "Class is live", `${value.title} has started. Join your classroom.`);
      } else {
        if (action === "end" && value.status !== "Live") throw new LiveError(409, "Only a live class can be ended.");
        if (action === "cancel" && !["Draft", "Scheduled", "Live"].includes(value.status)) throw new LiveError(409, "This class is already closed.");
        value.status = action === "end" ? "Completed" : "Cancelled"; value.endedAt = this.now();
        for (const ticket of state.tickets.filter((item) => item.classId === id)) ticket.revoked = true;
        for (const record of state.attendance.filter((item) => item.classId === id && !item.leftAt)) this.closeAttendance(record);
        // DB status and revoked tickets are authoritative even if the SFU is down.
        // Tick retries room deletion; stale JWTs have no initial media permissions.
        if (value.roomName) try { await this.video.deleteRoom(value.roomName); } catch { this.event(state, actor.id, "room.cleanup_pending", id); }
        this.notify(state, platform, value, action === "end" ? "Class completed" : "Class cancelled", `${value.title} ${action === "end" ? "has ended" : "was cancelled. Any payment requiring a refund is visible to the teacher"}.`);
      }
      value.updatedAt = this.now(); this.event(state, actor.id, `class.${action}`, id);
      return { data: this.view(state, platform, actor, value) };
    });
  }
  private closeAttendance(record: LiveState["attendance"][number], time = this.now()) {
    if (record.leftAt) return;
    record.leftAt = time;
    record.durationSeconds = Math.max(0, Math.floor((Date.parse(time) - Date.parse(record.joinedAt)) / 1000));
  }
  async checkout(actor: Actor, id: string, kind: "class" | "course", key: string) {
    if (actor.role !== "student") throw new LiveError(403, "Student access is required.");
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new LiveError(400, "A valid checkout idempotency key is required.");
    const platform = await this.platform();
    const result = await this.repository.transaction(async (state) => {
      const value = this.get(state, id);
      if (!["Scheduled", "Live"].includes(value.status)) throw new LiveError(409, "Enrollment is closed for this class.");
      if (this.access(state, platform, actor.id, value)) return { alreadyEnrolled: true };
      if (value.enrollmentDeadline && this.clock() > Date.parse(value.enrollmentDeadline)) throw new LiveError(409, "The enrollment deadline has passed.");
      const reserved = new Set(state.orders.filter((order) => order.studentId !== actor.id && order.status === "Pending" && Date.parse(order.createdAt) > this.clock() - 30 * 60000 && (order.kind === "class" ? order.targetId === id : value.accessType !== "individual" && order.targetId === value.courseId)).map((order) => order.studentId));
      if (this.enrolled(state, platform, value).length + reserved.size >= value.capacity) throw new LiveError(409, "This class is full or its remaining seats are reserved by pending checkouts.");
      const course = platform.courses.find((item) => item.id === value.courseId && item.status === "Published");
      if (kind === "class" && value.accessType === "course") throw new LiveError(400, "This session is included in its course package.");
      if (kind === "course" && (!course || value.accessType === "individual")) throw new LiveError(400, "This class does not offer a course package.");
      if (kind === "course" && this.ownsCourse(state, platform, actor.id, course!.id)) return { alreadyEnrolled: true };
      const amount = kind === "class" ? value.price : Math.round((course!.salePrice ?? course!.price) * 100);
      const targetId = kind === "class" ? id : course!.id;
      if (amount === 0) {
        if (kind === "class") state.enrollments.push({ id: randomUUID(), classId: id, studentId: actor.id, orderId: null, status: "Active", createdAt: this.now() });
        else state.orders.push({ id: randomUUID(), studentId: actor.id, kind, targetId, classId: id, amount: 0, currency: "INR", status: "Paid", providerOrderId: null, paymentId: null, idempotencyKey: key, refundedAmount: 0, createdAt: this.now(), paidAt: this.now() });
        this.event(state, actor.id, "enrollment.free", id); this.notify(state, platform, value, "Enrollment confirmed", `Your access to ${value.title} is ready.`);
        return { alreadyEnrolled: true };
      }
      if (!this.payments.configured()) throw new LiveError(503, "Razorpay checkout is not configured yet.", "PAYMENTS_NOT_CONFIGURED");
      let order = state.orders.find((item) => item.studentId === actor.id && item.kind === kind && item.targetId === targetId && item.status === "Pending");
      const keyed = state.orders.find((item) => item.studentId === actor.id && item.idempotencyKey === key);
      if (keyed && (keyed.kind !== kind || keyed.targetId !== targetId)) throw new LiveError(409, "This checkout key belongs to another purchase.");
      if (keyed && keyed.status !== "Pending") throw new LiveError(409, "Start a new checkout for this purchase.");
      if (!order) {
        order = { id: randomUUID(), studentId: actor.id, kind, targetId, classId: id, amount, currency: "INR", status: "Pending", providerOrderId: null, paymentId: null, idempotencyKey: key, refundedAmount: 0, createdAt: this.now(), paidAt: null };
        state.orders.push(order);
      }
      if (!order.providerOrderId) {
        try { order.providerOrderId = await this.payments.create(order); }
        catch { return { checkoutError: "The payment order could not be confirmed. Retry to resume the same checkout; no access was granted." }; }
      }
      this.event(state, actor.id, "payment.order_created", id, order.id);
      return { alreadyEnrolled: false, order: { id: order.id, providerOrderId: order.providerOrderId, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, name: kind === "course" ? course!.title : value.title } };
    });
    if ("checkoutError" in result) throw new LiveError(502, result.checkoutError ?? "Payment order preparation failed.");
    return result;
  }
  private activate(state: LiveState, platform: Platform, order: LiveOrder, paymentId: string) {
    if (["Paid", "Refunded"].includes(order.status)) return;
    order.status = "Paid"; order.paymentId = paymentId; order.paidAt = this.now();
    if (order.kind === "class") {
      const enrollment = state.enrollments.find((item) => item.classId === order.targetId && item.studentId === order.studentId);
      if (enrollment) Object.assign(enrollment, { status: "Active", orderId: order.id });
      else state.enrollments.push({ id: randomUUID(), classId: order.targetId, studentId: order.studentId, orderId: order.id, status: "Active", createdAt: this.now() });
    }
    this.event(state, order.studentId, "payment.captured", order.classId, order.id);
    state.notifications.push({ id: randomUUID(), classId: order.classId, studentId: order.studentId, title: "Payment confirmed", body: `Your ${order.kind === "course" ? "course package" : "live class"} access is active.`, createdAt: this.now(), read: false, emailSentAt: null });
  }
  async verifyPayment(actor: Actor, id: string, paymentId: string, signature: string) {
    const platform = await this.platform();
    return this.repository.transaction(async (state) => {
      const order = state.orders.find((item) => item.id === id && item.studentId === actor.id);
      if (!order || actor.role !== "student") throw new LiveError(404, "Order not found.");
      if (order.status === "Refunded") throw new LiveError(409, "This payment was refunded.");
      const payment = await this.payments.verify(order, paymentId, signature);
      this.activate(state, platform, order, payment.id);
      return { status: order.status, message: "Payment verified. Your access is active." };
    });
  }
  async paymentWebhook(raw: string, signature: string, eventId: string) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !safeEqual(createHmac("sha256", secret).update(raw).digest("hex"), signature)) throw new LiveError(401, "Invalid webhook signature.");
    const data = JSON.parse(raw) as { event: string; created_at: number; payload: { payment?: { entity: { id: string; order_id: string } }; refund?: { entity: { id: string; payment_id: string; amount: number } } } };
    const digest = createHash("sha256").update(raw).digest("hex");
    const platform = await this.platform();
    return this.repository.transaction(async (state) => {
      if (state.webhooks.some((receipt) => receipt.id === `razorpay:${eventId || digest}` || receipt.digest === digest)) return { received: true, duplicate: true };
      if (!["payment.captured", "order.paid", "payment.failed", "refund.processed"].includes(data.event)) return { received: true };
      const payment = data.payload?.payment?.entity;
      const refund = data.payload?.refund?.entity;
      if (refund && state.webhooks.some((receipt) => receipt.id === `razorpay-refund:${refund.id}`)) return { received: true, duplicate: true };
      const order = state.orders.find((item) => payment ? item.providerOrderId === payment.order_id : item.paymentId === refund?.payment_id);
      if (!order) throw new LiveError(503, "Order is not available yet; retry this webhook.");
      if (data.event === "payment.captured" || data.event === "order.paid") {
        if (!payment) throw new LiveError(400, "Missing payment entity.");
        const verified = await this.payments.verify(order, payment.id);
        this.activate(state, platform, order, verified.id);
      } else if (data.event === "payment.failed" && order.status === "Pending") order.status = "Failed";
      else if (data.event === "refund.processed" && refund) {
        order.refundedAmount = Math.min(order.amount, order.refundedAmount + refund.amount);
        if (order.refundedAmount >= order.amount) {
          order.status = "Refunded";
          for (const enrollment of state.enrollments.filter((item) => item.orderId === order.id)) enrollment.status = "Revoked";
          for (const ticket of state.tickets.filter((item) => item.actorId === order.studentId && item.role === "student" && !item.revoked)) {
            const value = this.get(state, ticket.classId);
            if (!this.access(state, platform, order.studentId, value)) {
              ticket.revoked = true;
              try { await this.video.remove(ticket.roomName, ticket.identity); } catch { /* Tick retries revoked removals. */ }
            }
          }
        }
        this.event(state, "razorpay", "payment.refunded", order.classId, order.id);
        state.notifications.push({ id: randomUUID(), classId: order.classId, studentId: order.studentId, title: "Refund processed", body: order.status === "Refunded" ? "Your payment has been fully refunded and purchased access revoked." : "A partial refund has been processed.", createdAt: this.now(), read: false, emailSentAt: null });
      }
      state.webhooks.push({ id: `razorpay:${eventId || digest}`, digest, createdAt: this.now() });
      if (refund) state.webhooks.push({ id: `razorpay-refund:${refund.id}`, digest, createdAt: this.now() });
      return { received: true };
    });
  }
  async join(actor: Actor, id: string) {
    const platform = await this.platform();
    return this.repository.transaction(async (state) => {
      const value = this.get(state, id);
      if (value.status !== "Live" || !value.roomName) throw new LiveError(409, "This class is not live.", "CLASS_NOT_LIVE");
      if (actor.role === "teacher") this.teacher(actor, value);
      else if (!this.access(state, platform, actor.id, value)) throw new LiveError(403, "A valid class or course enrollment is required.", "NOT_ENROLLED");
      if (state.tickets.filter((ticket) => ticket.actorId === actor.id && Date.parse(ticket.createdAt) > this.clock() - 60000).length >= 12) throw new LiveError(429, "Too many join attempts. Wait a minute.");
      const kicked = state.events.some((event) => event.classId === id && event.type === "participant.removed" && event.detail === actor.id);
      if (kicked && actor.role === "student") throw new LiveError(403, "The teacher removed you from this session.");
      const occupied = state.tickets.filter((ticket) => ticket.classId === id && ticket.role === "student" && ticket.actorId !== actor.id && !ticket.revoked && (ticket.usedSid ? Date.parse(ticket.heartbeatAt) > this.clock() - 45000 : Date.parse(ticket.expiresAt) > this.clock()));
      if (actor.role === "student" && new Set(occupied.map((ticket) => ticket.actorId)).size >= value.capacity) throw new LiveError(409, "The classroom is currently full. Try again when a seat becomes available.");
      for (const old of state.tickets.filter((ticket) => ticket.classId === id && ticket.actorId === actor.id && !ticket.revoked)) {
        old.revoked = true; if (old.usedSid) try { await this.video.remove(old.roomName, old.identity); } catch { /* Retried by tick. */ }
      }
      const ticket: JoinTicket = { id: randomUUID(), classId: id, actorId: actor.id, role: actor.role, identity: `${actor.role}-${randomUUID()}`, roomName: value.roomName, expiresAt: new Date(this.clock() + 30000).toISOString(), createdAt: this.now(), usedSid: null, revoked: false, microphone: false, camera: false, raisedHand: false, heartbeatAt: this.now() };
      const token = await this.video.token(ticket, actor.name);
      state.tickets.push(ticket); this.event(state, actor.id, "join.issued", id);
      return { token, url: process.env.LIVEKIT_URL, identity: ticket.identity, ticketId: ticket.id, title: value.title, startedAt: value.startedAt };
    });
  }
  async videoWebhook(event: VideoEvent) {
    if (!event.id) throw new LiveError(400, "Webhook ID is required.");
    const platform = await this.platform();
    return this.repository.transaction(async (state) => {
      if (state.webhooks.some((receipt) => receipt.id === `livekit:${event.id}`)) return { received: true };
      const value = state.classes.find((item) => item.roomName === event.room?.name);
      const ticket = state.tickets.find((item) => item.identity === event.participant?.identity && item.roomName === event.room?.name);
      if (event.event === "participant_joined" && ticket && !ticket.revoked && ticket.usedSid === event.participant?.sid) return { received: true };
      if (event.event === "participant_joined" && event.participant && event.room) {
        if (!value || value.status !== "Live" || !ticket || ticket.revoked || Date.parse(ticket.expiresAt) < this.clock() || ticket.usedSid || (ticket.role === "student" && !this.access(state, platform, ticket.actorId, value))) {
          await this.video.remove(event.room.name, event.participant.identity);
        } else {
          ticket.usedSid = event.participant.sid; ticket.heartbeatAt = this.now();
          await this.video.permissions(ticket.roomName, ticket.identity, ticket.role, ticket.microphone, ticket.camera);
          if (ticket.role === "student") state.attendance.push({ id: randomUUID(), classId: value.id, studentId: ticket.actorId, identity: ticket.identity, sid: event.participant.sid, joinedAt: this.now(), leftAt: null, lastSeenAt: this.now(), durationSeconds: 0 });
          this.event(state, ticket.actorId, "participant.joined", value.id);
        }
      } else if (event.event === "participant_left" && event.participant) {
        const record = state.attendance.find((item) => item.sid === event.participant!.sid && item.identity === event.participant!.identity);
        if (record) this.closeAttendance(record);
        if (ticket?.usedSid === event.participant.sid) ticket.revoked = true;
      } else if (event.event === "room_finished" && value?.status === "Live") {
        value.status = "Completed"; value.endedAt = this.now();
        for (const item of state.tickets.filter((item) => item.classId === value.id)) item.revoked = true;
        for (const record of state.attendance.filter((item) => item.classId === value.id && !item.leftAt)) this.closeAttendance(record);
        this.notify(state, platform, value, "Class ended", `${value.title} has ended.`);
      }
      state.webhooks.push({ id: `livekit:${event.id}`, digest: event.event, createdAt: this.now() });
      return { received: true };
    });
  }
  async admission(token: string) {
    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) throw new LiveError(503, "LiveKit is not configured.");
    let claims;
    try { claims = await new TokenVerifier(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).verify(token, 0); }
    catch { throw new LiveError(401, "Invalid or expired classroom token."); }
    const platform = await this.platform();
    return this.repository.transaction((state) => {
      const ticket = state.tickets.find((item) => item.identity === claims.sub && item.roomName === claims.video?.room);
      if (!ticket || ticket.revoked || (!ticket.usedSid && Date.parse(ticket.expiresAt) < this.clock())) throw new LiveError(403, "Classroom access has expired.");
      const value = this.get(state, ticket.classId);
      if (value.status !== "Live" || value.roomName !== ticket.roomName) throw new LiveError(403, "This classroom has ended.");
      if (ticket.role === "student" && !this.access(state, platform, ticket.actorId, value)) throw new LiveError(403, "Enrollment is no longer active.");
      // LiveKit refreshes JWTs during a session. Re-check current server-side
      // permissions at the signaling gateway, including refreshed/replayed JWTs.
      if (ticket.role === "student" && claims.video?.canPublish) {
        const allowed = [...(ticket.microphone ? ["microphone"] : []), ...(ticket.camera ? ["camera"] : [])];
        const names = new Map<unknown, string>([[TrackSource.MICROPHONE, "microphone"], [TrackSource.CAMERA, "camera"]]);
        if (!allowed.length || !claims.video.canPublishSources?.length || claims.video.canPublishSources.some((source) => !allowed.includes(names.get(source) ?? String(source)))) throw new LiveError(403, "Publishing permission was revoked.");
      }
      return { allowed: true };
    });
  }
  async interaction(actor: Actor, id: string, input: { action: "heartbeat" | "leave" | "hand" | "chat"; ticketId: string; text?: string; raised?: boolean }) {
    const platform = await this.platform();
    return this.repository.transaction(async (state) => {
      const value = this.get(state, id);
      const ticket = state.tickets.find((item) => item.id === input.ticketId && item.classId === id && item.actorId === actor.id && item.role === actor.role && !item.revoked);
      if (!ticket || value.status !== "Live") throw new LiveError(409, "Your classroom session has ended.", "SESSION_ENDED");
      if (actor.role === "student" && !this.access(state, platform, actor.id, value)) throw new LiveError(403, "Your enrollment is no longer active.");
      if (input.action === "leave") {
        ticket.revoked = true;
        if (ticket.usedSid) try { await this.video.remove(ticket.roomName, ticket.identity); } catch { /* Tick retries. */ }
        const record = state.attendance.find((item) => item.sid === ticket.usedSid && !item.leftAt);
        if (record) this.closeAttendance(record);
      } else if (input.action === "hand") ticket.raisedHand = Boolean(input.raised);
      else if (input.action === "chat") {
        if (!value.chatEnabled) throw new LiveError(403, "The teacher has paused chat.");
        const text = input.text?.trim() ?? "";
        if (!text || text.length > 1000) throw new LiveError(400, "Messages must contain between 1 and 1000 characters.");
        if (state.messages.filter((message) => message.actorId === actor.id && Date.parse(message.createdAt) > this.clock() - 60000).length >= 20) throw new LiveError(429, "Please slow down before sending more messages.");
        state.messages.push({ id: randomUUID(), classId: id, actorId: actor.id, role: actor.role, name: actor.name, text, hidden: false, createdAt: this.now() });
      }
      ticket.heartbeatAt = this.now();
      const record = state.attendance.find((item) => item.sid === ticket.usedSid && !item.leftAt);
      if (record) record.lastSeenAt = this.now();
      return { ok: true, status: value.status, chatEnabled: value.chatEnabled, microphone: ticket.microphone, camera: ticket.camera,
        messages: state.messages.filter((message) => message.classId === id && !message.hidden).slice(-100),
        participants: state.tickets.filter((item) => item.classId === id && !item.revoked && item.usedSid && Date.parse(item.heartbeatAt) > this.clock() - 45000).map((item) => ({ identity: item.identity, name: item.role === "teacher" ? value.teacherName : platform.students.find((student) => student.id === item.actorId)?.firstName ?? "Student", role: item.role, raisedHand: item.raisedHand, microphone: item.microphone, camera: item.camera })),
      };
    });
  }
  async moderate(actor: Actor, id: string, input: { action: "permissions" | "remove" | "chat" | "hide-message"; identity?: string; microphone?: boolean; camera?: boolean; enabled?: boolean; messageId?: string }) {
    return this.repository.transaction(async (state) => {
      const value = this.get(state, id); this.teacher(actor, value);
      if (value.status !== "Live" || !value.roomName) throw new LiveError(409, "The class is not live.");
      if (input.action === "chat") value.chatEnabled = Boolean(input.enabled);
      else if (input.action === "hide-message") {
        const message = state.messages.find((item) => item.id === input.messageId && item.classId === id);
        if (!message) throw new LiveError(404, "Message not found.");
        message.hidden = true;
      } else {
        const ticket = state.tickets.find((item) => item.identity === input.identity && item.classId === id && item.role === "student" && !item.revoked && item.usedSid);
        if (!ticket) throw new LiveError(404, "Connected student not found.");
        if (input.action === "remove") {
          await this.video.remove(value.roomName, ticket.identity); ticket.revoked = true;
          this.event(state, actor.id, "participant.removed", id, ticket.actorId);
          const attendance = state.attendance.find((item) => item.sid === ticket.usedSid && !item.leftAt);
          if (attendance) this.closeAttendance(attendance);
        } else {
          const microphone = Boolean(input.microphone), camera = Boolean(input.camera);
          await this.video.permissions(value.roomName, ticket.identity, "student", microphone, camera);
          ticket.microphone = microphone; ticket.camera = camera; ticket.raisedHand = false;
        }
      }
      this.event(state, actor.id, `moderation.${input.action}`, id, input.identity ?? input.messageId ?? "");
      return { ok: true };
    });
  }
  async report(actor: Actor, id?: string) {
    this.teacher(actor); const platform = await this.platform();
    return this.repository.transaction((state) => {
      const classes = state.classes.filter((value) => value.teacherId === actor.id && (!id || value.id === id));
      if (id) this.teacher(actor, this.get(state, id));
      const ids = new Set(classes.map((value) => value.id));
      const orders = state.orders.filter((order) => order.classId && ids.has(order.classId));
      const students = classes.flatMap((value) => this.enrolled(state, platform, value).map((student) => {
        const records = state.attendance.filter((record) => record.classId === value.id && record.studentId === student.id);
        const source = this.access(state, platform, student.id, value);
        return { classId: value.id, classTitle: value.title, studentId: student.id, name: `${student.firstName} ${student.lastName}`, email: student.email, enrollmentType: source, paymentStatus: source === "course" ? "Course access" : state.enrollments.find((item) => item.classId === value.id && item.studentId === student.id)?.orderId ? "Paid" : "Free", joinedAt: records[0]?.joinedAt ?? null, leftAt: records.at(-1)?.leftAt ?? null, durationSeconds: records.reduce((sum, record) => sum + (record.leftAt ? record.durationSeconds : Math.max(0, Math.floor((Math.min(this.clock(), Date.parse(record.lastSeenAt) + 45000) - Date.parse(record.joinedAt)) / 1000))), 0), connected: records.some((record) => !record.leftAt && Date.parse(record.lastSeenAt) > this.clock() - 45000) };
      }));
      return { classes: classes.length, upcoming: classes.filter((value) => value.status === "Scheduled").length, completed: classes.filter((value) => value.status === "Completed").length, paidEnrollments: orders.filter((order) => order.status === "Paid").length, courseEnrollments: students.filter((student) => student.enrollmentType === "course").length, revenue: orders.filter((order) => order.status === "Paid").reduce((sum, order) => sum + order.amount - order.refundedAmount, 0), students,
        orders: orders.map((order) => ({ ...order, studentName: platform.students.find((student) => student.id === order.studentId)?.firstName ?? "Student", classTitle: state.classes.find((value) => value.id === order.classId)?.title, refundRequired: order.status === "Paid" && state.classes.find((value) => value.id === order.classId)?.status === "Cancelled" })),
        audit: state.events.filter((event) => event.classId && ids.has(event.classId)).slice(-100).reverse(),
      };
    });
  }
  async requestRefund(actor: Actor, id: string) {
    return this.repository.transaction(async (state) => {
      const order = state.orders.find((item) => item.id === id);
      if (!order?.classId) throw new LiveError(404, "Order not found.");
      this.teacher(actor, this.get(state, order.classId));
      if (order.status !== "Paid" || order.refundedAmount > 0) throw new LiveError(409, "Only an unrefunded captured payment can be refunded here.");
      if (state.events.some((event) => event.type === "refund.requested" && event.detail === order.id)) throw new LiveError(409, "A refund is already awaiting provider confirmation.");
      await this.payments.refund(order); this.event(state, actor.id, "refund.requested", order.classId, order.id);
      return { message: "Refund submitted. Access updates after the signed provider confirmation." };
    });
  }
  async notifications(actor: Actor, readId?: string) {
    return this.repository.transaction((state) => {
      const values = state.notifications.filter((item) => item.studentId === actor.id);
      if (readId) { const value = values.find((item) => item.id === readId); if (value) value.read = true; }
      return { data: values.slice(-100).reverse() };
    });
  }
  async history(actor: Actor) { return this.repository.transaction((state) => ({ data: state.attendance.filter((record) => record.studentId === actor.id), orders: state.orders.filter((order) => order.studentId === actor.id) })); }
  async tick() {
    const platform = await this.platform();
    await this.repository.transaction(async (state) => {
      for (const ticket of state.tickets.filter((ticket) => !ticket.revoked && ticket.usedSid && Date.parse(ticket.heartbeatAt) < this.clock() - 45000)) {
        ticket.revoked = true;
        const record = state.attendance.find((item) => item.sid === ticket.usedSid && !item.leftAt);
        if (record) this.closeAttendance(record, record.lastSeenAt);
      }
      for (const ticket of state.tickets.filter((ticket) => ticket.revoked && ticket.usedSid)) {
        try { await this.video.remove(ticket.roomName, ticket.identity); ticket.usedSid = null; } catch { /* Reconcile again on next tick. */ }
      }
      for (const value of state.classes) {
        if (["Completed", "Cancelled"].includes(value.status) && value.roomName) {
          try { await this.video.deleteRoom(value.roomName); value.roomName = null; } catch { /* Preserve pending cleanup for next tick. */ }
        }
        if (value.status === "Scheduled" && Date.parse(value.startsAt) >= this.clock() && Date.parse(value.startsAt) <= this.clock() + 15 * 60000 && !state.events.some((event) => event.classId === value.id && event.type === "reminder" && event.detail === value.startsAt)) {
          this.notify(state, platform, value, "Class starting soon", `${value.title} starts in about ${Math.ceil((Date.parse(value.startsAt) - this.clock()) / 60000)} minutes.`);
          this.event(state, "system", "reminder", value.id, value.startsAt);
        }
      }
    });
  }
}
