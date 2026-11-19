"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Topbar } from "./topbar";
import { useToast } from "./toast";

type SupportQuery = { id: string; referenceNumber: string; studentName: string; studentEmail: string; subject: string; message: string; status: "Open" | "In Progress" | "Resolved"; adminReply: string; createdAt: string; updatedAt: string };

export function SupportWorkspace() {
  const { showToast } = useToast();
  const [queries, setQueries] = useState<SupportQuery[]>([]);
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<SupportQuery | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/support-queries");
    if (response.status === 401) { window.location.assign("/login"); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load support queries.");
    setQueries(result.data);
  }, []);

  useEffect(() => {
    load().catch((error: Error) => showToast(error.message, "error"));
    const timer = window.setInterval(() => load().catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [load, showToast]);

  const filtered = useMemo(() => status === "All" ? queries : queries.filter((query) => query.status === status), [queries, status]);
  const openCount = queries.filter((query) => query.status !== "Resolved").length;

  async function save() {
    if (!selected) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/support-queries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status: selected.status, adminReply: selected.adminReply }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update support query.");
      setQueries((items) => items.map((item) => item.id === result.data.id ? result.data : item));
      setSelected(null);
      showToast(result.message, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update support query.", "error");
    } finally { setPending(false); }
  }

  return <>
    <Topbar title="Support queries" subtitle="Review student questions, reply, and track resolution status."/>
    <div className="page-content">
      <section className="panel support-panel">
        <header className="panel-header"><div><h2>Student help requests</h2><p>{openCount} query{openCount === 1 ? "" : "ies"} awaiting resolution</p></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Open</option><option>In Progress</option><option>Resolved</option></select></header>
        <div className="table-wrap"><table className="resource-table support-table"><thead><tr><th>Reference</th><th>Student</th><th>Subject</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>{filtered.map((query) => <tr key={query.id}><td><strong>{query.referenceNumber}</strong></td><td><span className="support-student"><strong>{query.studentName}</strong><small>{query.studentEmail}</small></span></td><td><span className="support-subject"><strong>{query.subject}</strong><small>{query.message}</small></span></td><td><span className={`resource-status support-${query.status.toLowerCase().replace(" ", "-")}`}>{query.status}</span></td><td>{new Date(query.createdAt).toLocaleString("en-IN")}</td><td><button className="secondary-action" onClick={() => setSelected({ ...query })}>Manage</button></td></tr>)}</tbody></table>{!filtered.length && <div className="resource-empty"><strong>No support queries</strong><span>Student submissions will appear here with their reference number.</span></div>}</div>
      </section>
    </div>
    {selected && <div className="modal-backdrop"><section className="resource-modal support-modal" role="dialog" aria-modal="true" aria-label="Manage support query"><header><div><small>{selected.referenceNumber}</small><h2>{selected.subject}</h2></div><button onClick={() => setSelected(null)} aria-label="Close">×</button></header><div className="support-query-detail"><div><strong>{selected.studentName}</strong><small>{selected.studentEmail}</small></div><p>{selected.message}</p><label>Status<select value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value as SupportQuery["status"] })}><option>Open</option><option>In Progress</option><option>Resolved</option></select></label><label>Reply to student<textarea rows={6} maxLength={2000} value={selected.adminReply} onChange={(event) => setSelected({ ...selected, adminReply: event.target.value })} placeholder="Add an update or resolution for the student…" /></label></div><footer><button className="secondary-action" onClick={() => setSelected(null)}>Cancel</button><button className="primary-action" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save update"}</button></footer></section></div>}
  </>;
}
