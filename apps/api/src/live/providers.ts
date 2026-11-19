import { createHmac } from "node:crypto";
import { AccessToken, RoomServiceClient, WebhookReceiver, TrackSource } from "livekit-server-sdk";
import { safeEqual } from "./auth.js";
import { LiveError, type JoinTicket, type LiveOrder } from "./types.js";

export interface ClassroomVideo {
  configured(): boolean;
  createRoom(name: string, capacity: number): Promise<void>;
  deleteRoom(name: string): Promise<void>;
  token(ticket: JoinTicket, name: string): Promise<string>;
  permissions(room: string, identity: string, role: "teacher" | "student", microphone: boolean, camera: boolean): Promise<void>;
  remove(room: string, identity: string): Promise<void>;
}
export class LiveKitVideo implements ClassroomVideo {
  configured() { return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_WEBHOOK_ENABLED === "true" && process.env.LIVEKIT_ADMISSION_ENABLED === "true"); }
  private client() {
    if (!this.configured()) throw new LiveError(503, "Live video is not configured. Set the LiveKit URL, keys and admission webhook.", "LIVEKIT_NOT_CONFIGURED");
    return new RoomServiceClient((process.env.LIVEKIT_INTERNAL_URL ?? process.env.LIVEKIT_URL!).replace(/^ws/, "http"), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  }
  async createRoom(name: string, capacity: number) { await this.client().createRoom({ name, maxParticipants: capacity + 1, emptyTimeout: 300, departureTimeout: 30 }); }
  async deleteRoom(name: string) { await this.client().deleteRoom(name); }
  async token(ticket: JoinTicket, name: string) {
    this.client();
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: ticket.identity, name, ttl: "30s", metadata: JSON.stringify({ role: ticket.role }) });
    // Admission is fail-closed: a signed participant_joined webhook validates
    // this single-use ticket before the SFU grants media access. Self-hosted
    // LiveKit does not revoke old JWTs when a participant is removed.
    token.addGrant({ room: ticket.roomName, roomJoin: true, canSubscribe: false, canPublish: false, canPublishData: false, canUpdateOwnMetadata: false });
    return token.toJwt();
  }
  async permissions(room: string, identity: string, role: "teacher" | "student", microphone: boolean, camera: boolean) {
    const sources = role === "teacher" ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [...(microphone ? [TrackSource.MICROPHONE] : []), ...(camera ? [TrackSource.CAMERA] : [])];
    await this.client().updateParticipant(room, identity, { permission: { canSubscribe: true, canPublish: role === "teacher" || microphone || camera, canPublishSources: sources, canPublishData: false, canUpdateMetadata: false } });
  }
  async remove(room: string, identity: string) { await this.client().removeParticipant(room, identity); }
  receiver() { this.client(); return new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!); }
}

export type VerifiedPayment = { id: string; order_id: string; amount: number; currency: string; status: string; amount_refunded?: number };
export interface PaymentGateway {
  configured(): boolean;
  create(order: LiveOrder): Promise<string>;
  verify(order: LiveOrder, paymentId: string, signature?: string): Promise<VerifiedPayment>;
  refund(order: LiveOrder): Promise<void>;
}
export class RazorpayGateway implements PaymentGateway {
  configured() { return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); }
  private async request<T>(endpoint: string, body?: unknown): Promise<T> {
    if (!this.configured()) throw new LiveError(503, "Razorpay checkout is not configured yet.", "PAYMENTS_NOT_CONFIGURED");
    const response = await fetch(`https://api.razorpay.com/v1/${endpoint}`, {
      method: body === undefined ? "GET" : "POST", signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new LiveError(502, "Payment provider request failed. Please retry or contact support.");
    return response.json() as Promise<T>;
  }
  async create(order: LiveOrder) {
    // Reconcile an earlier timed-out order creation before attempting a retry.
    const existing = await this.request<{ items: { id: string; receipt: string }[] }>(`orders?receipt=${encodeURIComponent(order.id)}`);
    const found = existing.items.find((item) => item.receipt === order.id);
    if (found) return found.id;
    return (await this.request<{ id: string }>("orders", { amount: order.amount, currency: order.currency, receipt: order.id, notes: { live_order_id: order.id } })).id;
  }
  async verify(order: LiveOrder, paymentId: string, signature?: string) {
    if (signature !== undefined) {
      const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${order.providerOrderId}|${paymentId}`).digest("hex");
      if (!safeEqual(expected, signature)) throw new LiveError(400, "Payment signature is invalid.");
    }
    const payment = await this.request<VerifiedPayment>(`payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== order.providerOrderId || payment.amount !== order.amount || payment.currency !== order.currency) throw new LiveError(400, "Payment does not match this order.");
    if (payment.status !== "captured") throw new LiveError(409, "Payment confirmation is pending. Access will unlock after capture.", "PAYMENT_PENDING");
    return payment;
  }
  async refund(order: LiveOrder) {
    if (!order.paymentId) throw new LiveError(409, "No captured payment exists.");
    const receipt = `rf_${order.id}`;
    const existing = await this.request<{ items: { receipt?: string }[] }>(`payments/${encodeURIComponent(order.paymentId)}/refunds`);
    if (existing.items.some((refund) => refund.receipt === receipt)) return;
    await this.request(`payments/${encodeURIComponent(order.paymentId)}/refund`, { amount: order.amount, receipt });
  }
}
