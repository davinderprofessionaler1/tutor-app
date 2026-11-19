import { randomBytes, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizedStore, hasSafeOrigin } from "../../../../lib/api-auth";
import type { AdminStore, OrderRecord, OrderStatus } from "../../../../lib/admin-store";
import { writeAdminStore } from "../../../../lib/admin-store";

const paymentProviders = new Set(["Manual", "Razorpay", "Stripe", "Other"]);
const transitions: Record<OrderStatus, OrderStatus[]> = {
  Pending: ["Paid", "Failed", "Cancelled"],
  Failed: ["Paid", "Cancelled"],
  Paid: ["Refunded"],
  Refunded: [],
  Cancelled: [],
};

function syncCourseStudentCounts(store: AdminStore) {
  for (const course of store.courses) course.students = store.students.filter((student) => student.courseIds.includes(course.id)).length;
}

function couponDiscount(store: AdminStore, code: string, subtotal: number) {
  if (!code) return { coupon: null, discountAmount: 0 };
  const coupon = store.coupons.find((item) => item.code.toUpperCase() === code.toUpperCase());
  if (!coupon || !coupon.active) throw new Error("Coupon is not active.");
  if (coupon.endsAt && coupon.endsAt < new Date().toISOString().slice(0, 10)) throw new Error("Coupon has expired.");
  if (coupon.usageLimit > 0 && coupon.used >= coupon.usageLimit) throw new Error("Coupon usage limit has been reached.");
  if (subtotal < coupon.minimumOrder) throw new Error(`Minimum order value for ${coupon.code} is ₹${coupon.minimumOrder.toLocaleString("en-IN")}.`);
  const rawDiscount = coupon.discountType === "Percentage" ? subtotal * coupon.discountValue / 100 : coupon.discountValue;
  return { coupon, discountAmount: Math.min(subtotal, Math.max(0, Math.round(rawDiscount * 100) / 100)) };
}

export async function GET(request: NextRequest) {
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ data: store.orders ?? [] });
}

export async function POST(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid order data." }, { status: 400 });

  const studentId = String(body.studentId ?? "").trim();
  const courseId = String(body.courseId ?? "").trim();
  const couponCode = String(body.couponCode ?? "").trim().toUpperCase();
  const paymentProvider = String(body.paymentProvider ?? "Manual").trim();
  const student = store.students.find((item) => item.id === studentId);
  const course = store.courses.find((item) => item.id === courseId && item.status === "Published");
  if (!student) return NextResponse.json({ error: "Select a valid student." }, { status: 400 });
  if (student.status !== "Active") return NextResponse.json({ error: "Orders cannot be created for a blocked student." }, { status: 409 });
  if (!course) return NextResponse.json({ error: "Select a published course." }, { status: 400 });
  if (!paymentProviders.has(paymentProvider)) return NextResponse.json({ error: "Unsupported payment provider." }, { status: 400 });

  const subtotal = Math.max(0, course.salePrice || course.price);
  let discountAmount = 0;
  try { discountAmount = couponDiscount(store, couponCode, subtotal).discountAmount; }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const now = new Date().toISOString();
  const order: OrderRecord = {
    id: randomUUID(),
    orderNumber: `ORD-${now.slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
    studentId,
    courseId,
    couponCode,
    subtotal,
    discountAmount,
    totalAmount: Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100),
    currency: "INR",
    status: "Pending",
    paymentProvider,
    paymentReference: "",
    enrollmentStatus: "Pending",
    enrollmentCreated: false,
    couponUsageRecorded: false,
    createdAt: now,
    paidAt: "",
    refundedAt: "",
    updatedAt: now,
  };
  store.orders.unshift(order);
  await writeAdminStore(store);
  return NextResponse.json({ message: `${order.orderNumber} created. Confirm payment before enrollment.`, data: order }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!hasSafeOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const store = await authorizedStore(request);
  if (!store) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const order = store.orders.find((item) => item.id === String(body?.id ?? ""));
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const nextStatus = String(body?.status ?? "") as OrderStatus;
  if (!transitions[order.status]?.includes(nextStatus)) return NextResponse.json({ error: `${order.status} orders cannot be changed to ${nextStatus || "that status"}.` }, { status: 409 });

  const now = new Date().toISOString();
  const student = store.students.find((item) => item.id === order.studentId);
  const course = store.courses.find((item) => item.id === order.courseId);
  if (!student || !course) return NextResponse.json({ error: "The order's student or course no longer exists." }, { status: 409 });

  if (nextStatus === "Paid") {
    const alreadyAssigned = student.courseIds.includes(course.id);
    if (!alreadyAssigned) student.courseIds.push(course.id);
    order.enrollmentCreated = !alreadyAssigned;
    order.enrollmentStatus = "Active";
    order.paidAt = now;
    order.paymentReference = String(body?.paymentReference ?? "").trim().slice(0, 160);
    if (order.couponCode && !order.couponUsageRecorded) {
      const coupon = store.coupons.find((item) => item.code === order.couponCode);
      if (coupon) coupon.used += 1;
      order.couponUsageRecorded = true;
    }
  }
  if (nextStatus === "Failed" || nextStatus === "Cancelled") order.enrollmentStatus = "Not created";
  if (nextStatus === "Refunded") {
    order.refundedAt = now;
    order.enrollmentStatus = "Revoked";
    const hasAnotherPaidOrder = store.orders.some((item) => item.id !== order.id && item.studentId === order.studentId && item.courseId === order.courseId && item.status === "Paid");
    if (order.enrollmentCreated && !hasAnotherPaidOrder) student.courseIds = student.courseIds.filter((id) => id !== course.id);
  }
  order.status = nextStatus;
  order.updatedAt = now;
  syncCourseStudentCounts(store);
  await writeAdminStore(store);
  return NextResponse.json({ message: nextStatus === "Paid" ? "Payment confirmed and course access activated." : nextStatus === "Refunded" ? "Refund recorded and purchased access revoked." : `Order marked ${nextStatus.toLowerCase()}.`, data: order });
}
