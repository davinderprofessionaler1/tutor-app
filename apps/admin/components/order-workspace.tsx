"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icons } from "./icons";
import { Topbar } from "./topbar";
import { useToast } from "./toast";
import { useActionDialog } from "./action-dialog";

type OrderStatus = "Pending" | "Paid" | "Failed" | "Refunded" | "Cancelled";
type Order = {
  id: string; orderNumber: string; studentId: string; courseId: string; couponCode: string; subtotal: number; discountAmount: number;
  totalAmount: number; currency: string; status: OrderStatus; paymentProvider: string; paymentReference: string; enrollmentStatus: string;
  createdAt: string; paidAt: string; refundedAt: string; updatedAt: string;
};
type Student = { id: string; firstName: string; lastName: string; email: string; status: "Active" | "Blocked" };
type Course = { id: string; title: string; price: number; salePrice: number; status: string };
type Coupon = { id: string; code: string; active: boolean; endsAt: string };

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
const dateTime = (value: string) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

async function jsonResponse(response: Response) {
  const result = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

function statusClass(status: string) { return `order-status order-status-${status.toLowerCase().replaceAll(" ", "-")}`; }

export function OrderWorkspace() {
  const { showToast } = useToast();
  const { confirm, prompt } = useActionDialog();
  const [orders, setOrders] = useState<Order[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [editorOpen, setEditorOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState({ studentId: "", courseId: "", couponCode: "", paymentProvider: "Manual" });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/orders").then(jsonResponse),
      fetch("/api/admin/resources/students").then(jsonResponse),
      fetch("/api/admin/resources/courses").then(jsonResponse),
      fetch("/api/admin/resources/coupons").then(jsonResponse),
    ]).then(([orderData, studentData, courseData, couponData]) => {
      setOrders(orderData.data);
      setStudents(studentData.data);
      setCourses(courseData.data);
      setCoupons(couponData.data);
    }).catch((error: Error) => showToast(error.message, "error"));
  }, [showToast]);

  const studentMap = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const visible = useMemo(() => orders.filter((order) => {
    const student = studentMap.get(order.studentId);
    const course = courseMap.get(order.courseId);
    const haystack = `${order.orderNumber} ${student?.firstName ?? ""} ${student?.lastName ?? ""} ${student?.email ?? ""} ${course?.title ?? ""} ${order.paymentReference}`.toLowerCase();
    return (status === "All" || order.status === status) && haystack.includes(search.trim().toLowerCase());
  }), [orders, studentMap, courseMap, search, status]);
  const paidOrders = orders.filter((order) => order.status === "Paid");
  const refundedOrders = orders.filter((order) => order.status === "Refunded");
  const revenue = paidOrders.reduce((total, order) => total + order.totalAmount, 0);

  function openCreate() {
    const firstStudent = students.find((student) => student.status === "Active");
    const firstCourse = courses.find((course) => course.status === "Published");
    setDraft({ studentId: firstStudent?.id ?? "", courseId: firstCourse?.id ?? "", couponCode: "", paymentProvider: "Manual" });
    setEditorOpen(true);
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await jsonResponse(await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }));
      setOrders((current) => [result.data, ...current]);
      setEditorOpen(false);
      showToast(result.message);
    } catch (error) { showToast((error as Error).message, "error"); }
    finally { setPending(false); }
  }

  async function changeStatus(order: Order, nextStatus: OrderStatus) {
    let paymentReference = order.paymentReference;
    if (nextStatus === "Paid") {
      const reference = await prompt({ title: "Record payment", description: `Mark ${order.orderNumber} as paid. You can add a payment reference for your records.`, inputLabel: "Payment reference (optional for manual payments)", defaultValue: paymentReference, confirmLabel: "Mark as paid" });
      if (reference === null) return;
      paymentReference = reference;
    }
    if (nextStatus === "Refunded" && !await confirm({ title: "Record full refund?", description: `Purchased course access created by ${order.orderNumber} will be revoked.`, confirmLabel: "Record refund", tone: "danger" })) return;
    setPending(true);
    try {
      const result = await jsonResponse(await fetch("/api/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, status: nextStatus, paymentReference }) }));
      setOrders((current) => current.map((item) => item.id === order.id ? result.data : item));
      showToast(result.message);
    } catch (error) { showToast((error as Error).message, "error"); }
    finally { setPending(false); }
  }

  function exportOrders() {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["Order", "Created", "Student", "Email", "Course", "Subtotal", "Discount", "Total", "Currency", "Status", "Provider", "Payment reference", "Enrollment", "Coupon"], ...visible.map((order) => {
      const student = studentMap.get(order.studentId); const course = courseMap.get(order.courseId);
      return [order.orderNumber, order.createdAt, `${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim(), student?.email ?? "", course?.title ?? "", order.subtotal, order.discountAmount, order.totalAmount, order.currency, order.status, order.paymentProvider, order.paymentReference, order.enrollmentStatus, order.couponCode];
    })];
    const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
    showToast(`${visible.length} order${visible.length === 1 ? "" : "s"} exported.`);
  }

  return <>
    <Topbar title="Orders" subtitle="Review purchases, payments, refunds, and enrollment status." action={<button className="primary-action" type="button" onClick={openCreate}><Icons.plus /> Record order</button>} />
    <div className="page-content resource-page order-page">
      <section className="resource-summary order-summary">
        <div><span>Total orders</span><strong>{orders.length}</strong></div>
        <div><span>Paid</span><strong>{paidOrders.length}</strong></div>
        <div><span>Net captured</span><strong>{money(revenue)}</strong></div>
        <div><span>Refunded</span><strong>{refundedOrders.length}</strong></div>
      </section>
      <section className="panel resource-panel">
        <div className="resource-toolbar">
          <label className="small-search"><Icons.search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, students or courses" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Pending</option><option>Paid</option><option>Failed</option><option>Refunded</option><option>Cancelled</option></select>
          <button className="secondary-action" type="button" onClick={exportOrders} disabled={!visible.length}>Export CSV</button>
        </div>
        <div className="table-wrap"><table className="resource-table order-table"><thead><tr><th>Order</th><th>Student</th><th>Course</th><th>Amount</th><th>Payment</th><th>Enrollment</th><th>Created</th><th>Actions</th></tr></thead><tbody>
          {visible.map((order) => { const student = studentMap.get(order.studentId); const course = courseMap.get(order.courseId); return <tr key={order.id}>
            <td><strong>{order.orderNumber}</strong><small className="table-subtext">{order.couponCode ? `Coupon ${order.couponCode} · -${money(order.discountAmount)}` : "No coupon"}</small></td>
            <td><strong>{student ? `${student.firstName} ${student.lastName}` : "Removed student"}</strong><small className="table-subtext">{student?.email ?? order.studentId}</small></td>
            <td><strong>{course?.title ?? "Removed course"}</strong></td>
            <td><strong>{money(order.totalAmount)}</strong><small className="table-subtext">Subtotal {money(order.subtotal)}</small></td>
            <td><span className={statusClass(order.status)}>{order.status}</span><small className="table-subtext">{order.paymentProvider}{order.paymentReference ? ` · ${order.paymentReference}` : ""}</small></td>
            <td><span className={statusClass(order.enrollmentStatus)}>{order.enrollmentStatus}</span></td>
            <td>{dateTime(order.createdAt)}</td>
            <td><div className="row-actions order-actions">{(order.status === "Pending" || order.status === "Failed") && <button disabled={pending} onClick={() => changeStatus(order, "Paid")}>Confirm paid</button>}{order.status === "Pending" && <button disabled={pending} onClick={() => changeStatus(order, "Failed")}>Mark failed</button>}{order.status === "Paid" && <button className="danger" disabled={pending} onClick={() => changeStatus(order, "Refunded")}>Record refund</button>}</div></td>
          </tr>; })}
        </tbody></table>{!visible.length && <div className="resource-empty"><strong>No orders found</strong><span>Record a pending order or change the filters.</span></div>}</div>
      </section>
    </div>
    {editorOpen && <div className="modal-backdrop"><section className="resource-modal order-modal" role="dialog" aria-modal="true" aria-label="Record order"><header><div><small>Manual order</small><h2>Record a new order</h2></div><button type="button" onClick={() => setEditorOpen(false)} aria-label="Close">×</button></header><form onSubmit={createOrder}><div className="resource-form-grid">
      <label className="wide">Student<select required value={draft.studentId} onChange={(event) => setDraft({ ...draft, studentId: event.target.value })}><option value="">Select student</option>{students.filter((student) => student.status === "Active").map((student) => <option value={student.id} key={student.id}>{student.firstName} {student.lastName} · {student.email}</option>)}</select></label>
      <label className="wide">Published course<select required value={draft.courseId} onChange={(event) => setDraft({ ...draft, courseId: event.target.value })}><option value="">Select course</option>{courses.filter((course) => course.status === "Published").map((course) => <option value={course.id} key={course.id}>{course.title} · {money(course.salePrice || course.price)}</option>)}</select></label>
      <label>Coupon<select value={draft.couponCode} onChange={(event) => setDraft({ ...draft, couponCode: event.target.value })}><option value="">No coupon</option>{coupons.filter((coupon) => coupon.active).map((coupon) => <option value={coupon.code} key={coupon.id}>{coupon.code}</option>)}</select></label>
      <label>Payment provider<select value={draft.paymentProvider} onChange={(event) => setDraft({ ...draft, paymentProvider: event.target.value })}><option>Manual</option><option>Razorpay</option><option>Stripe</option><option>Other</option></select></label>
      <p className="order-form-note wide">This creates a pending order only. Course access is activated after an administrator confirms payment or a configured provider webhook confirms it.</p>
    </div><footer><button className="secondary-action" type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="primary-action" type="submit" disabled={pending}>{pending ? "Creating…" : "Create pending order"}</button></footer></form></section></div>}
  </>;
}
