"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Topbar } from "./topbar";
import { useToast } from "./toast";

type ReviewStatus = "Pending" | "Approved" | "Rejected";
type Review = {
  id: string; courseId: string; courseTitle: string; studentId: string; studentName: string;
  rating: number; comment: string; status: ReviewStatus; submittedAt: string; moderatedAt: string; updatedAt: string;
};

export function ReviewWorkspace() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<"All" | ReviewStatus>("Pending");
  const [pendingId, setPendingId] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/reviews");
    if (response.status === 401) { window.location.assign("/login"); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load reviews.");
    setReviews(result.data);
  }, []);

  useEffect(() => {
    load().catch((error: Error) => showToast(error.message, "error"));
    const timer = window.setInterval(() => load().catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [load, showToast]);

  const visible = useMemo(() => status === "All" ? reviews : reviews.filter((review) => review.status === status), [reviews, status]);
  const count = (value: ReviewStatus) => reviews.filter((review) => review.status === value).length;

  async function moderate(review: Review, nextStatus: ReviewStatus) {
    setPendingId(review.id);
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update review.");
      setReviews((items) => items.map((item) => item.id === result.data.id ? result.data : item));
      showToast(result.message, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update review.", "error");
    } finally { setPendingId(""); }
  }

  return <>
    <Topbar title="Reviews" subtitle="Approve student feedback before it appears in the learning app." />
    <div className="page-content review-page">
      <section className="resource-summary review-summary">
        <div><span>Pending approval</span><strong>{count("Pending")}</strong></div>
        <div><span>Published</span><strong>{count("Approved")}</strong></div>
        <div><span>Rejected</span><strong>{count("Rejected")}</strong></div>
      </section>
      <section className="panel review-panel">
        <header className="panel-header"><div><h2>Course reviews</h2><p>Only approved reviews are visible to students.</p></div><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option>All</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></header>
        <div className="table-wrap"><table className="resource-table review-table"><thead><tr><th>Student</th><th>Course</th><th>Rating</th><th>Review</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{visible.map((review) => <tr key={review.id}><td><strong>{review.studentName}</strong></td><td><strong>{review.courseTitle}</strong></td><td><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></td><td><p className="review-comment">{review.comment}</p></td><td><span className={`resource-status review-${review.status.toLowerCase()}`}>{review.status}</span></td><td>{new Date(review.submittedAt).toLocaleString("en-IN")}</td><td><div className="row-actions review-actions">{review.status !== "Approved" && <button disabled={pendingId === review.id} onClick={() => moderate(review, "Approved")}>Approve</button>}{review.status !== "Rejected" && <button className="danger" disabled={pendingId === review.id} onClick={() => moderate(review, "Rejected")}>Reject</button>}</div></td></tr>)}</tbody></table>{!visible.length && <div className="resource-empty"><strong>No {status === "All" ? "" : status.toLowerCase()} reviews</strong><span>New student reviews will appear here for approval.</span></div>}</div>
      </section>
    </div>
  </>;
}
