"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icons } from "./icons";
import { Topbar } from "./topbar";
import { useToast } from "./toast";
import { useActionDialog } from "./action-dialog";

type ResourceKind = "courses" | "videos" | "coupons" | "templates";
type Item = Record<string, string | number | boolean> & { id: string; updatedAt: string };
type Field = { name: string; label: string; type?: "text" | "number" | "url" | "date" | "textarea" | "checkbox" | "select"; options?: string[]; required?: boolean; wide?: boolean; placeholder?: string };

const configs: Record<ResourceKind, {
  title: string; subtitle: string; singular: string; action: string; search: string; filterField: string; filterOptions: string[];
  defaults: Record<string, string | number | boolean>; fields: Field[];
}> = {
  courses: {
    title: "Courses", subtitle: "Create, price, publish, and manage your course catalogue.", singular: "course", action: "New course", search: "Search courses", filterField: "status", filterOptions: ["Published", "Draft", "Archived"],
    defaults: { title: "", category: "", status: "Draft", price: 0, salePrice: 0, lessons: 0, students: 0, featured: false },
    fields: [
      { name: "title", label: "Course title", required: true, wide: true }, { name: "category", label: "Category", required: true },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Published", "Archived"] },
      { name: "price", label: "Original price (₹)", type: "number" }, { name: "salePrice", label: "Sale price (₹)", type: "number" },
      { name: "lessons", label: "Lessons", type: "number" }, { name: "students", label: "Students", type: "number" },
      { name: "featured", label: "Feature this course", type: "checkbox", wide: true },
    ],
  },
  videos: {
    title: "Video library", subtitle: "Manage hosted course videos, processing state, and downloads.", singular: "video", action: "Add video", search: "Search videos", filterField: "status", filterOptions: ["Ready", "Processing", "Draft", "Failed"],
    defaults: { title: "", course: "", provider: "Vimeo", sourceUrl: "", durationMinutes: 0, status: "Draft", downloadReady: false },
    fields: [
      { name: "title", label: "Video title", required: true, wide: true }, { name: "course", label: "Assigned course" },
      { name: "provider", label: "Provider", type: "select", options: ["Vimeo", "YouTube", "Bunny Stream", "S3 / MinIO", "Other"], required: true },
      { name: "sourceUrl", label: "Video source URL", type: "url", required: true, wide: true, placeholder: "https://" },
      { name: "durationMinutes", label: "Duration (minutes)", type: "number" }, { name: "status", label: "Status", type: "select", options: ["Draft", "Processing", "Ready", "Failed"] },
      { name: "downloadReady", label: "Allow protected download", type: "checkbox", wide: true },
    ],
  },
  coupons: {
    title: "Discount coupons", subtitle: "Create promotions with value, validity, and usage controls.", singular: "coupon", action: "New coupon", search: "Search coupon codes", filterField: "active", filterOptions: ["Active", "Inactive"],
    defaults: { code: "", description: "", discountType: "Percentage", discountValue: 10, minimumOrder: 0, usageLimit: 100, used: 0, endsAt: "", active: true },
    fields: [
      { name: "code", label: "Coupon code", required: true }, { name: "description", label: "Description", wide: true },
      { name: "discountType", label: "Discount type", type: "select", options: ["Percentage", "Fixed"] }, { name: "discountValue", label: "Discount value", type: "number", required: true },
      { name: "minimumOrder", label: "Minimum order (₹)", type: "number" }, { name: "usageLimit", label: "Total usage limit", type: "number" },
      { name: "used", label: "Times used", type: "number" }, { name: "endsAt", label: "Valid until", type: "date" },
      { name: "active", label: "Coupon is active", type: "checkbox", wide: true },
    ],
  },
  templates: {
    title: "Global templates", subtitle: "Manage reusable email, push, SMS, and web message templates.", singular: "template", action: "New template", search: "Search templates", filterField: "channel", filterOptions: ["Email", "Push", "SMS", "Web"],
    defaults: { key: "", name: "", channel: "Email", subject: "", body: "", enabled: true },
    fields: [
      { name: "name", label: "Template name", required: true }, { name: "key", label: "Unique key", required: true, placeholder: "student_welcome" },
      { name: "channel", label: "Channel", type: "select", options: ["Email", "Push", "SMS", "Web"] }, { name: "subject", label: "Subject / title", wide: true },
      { name: "body", label: "Template content", type: "textarea", required: true, wide: true, placeholder: "Use variables such as {{first_name}} and {{course_name}}" },
      { name: "enabled", label: "Template is enabled", type: "checkbox", wide: true },
    ],
  },
};

async function jsonResponse(response: Response) {
  const result = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

export function ResourceWorkspace({ kind }: { kind: ResourceKind }) {
  const { showToast } = useToast();
  const { confirm } = useActionDialog();
  const config = configs[kind];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [editor, setEditor] = useState<Record<string, string | number | boolean> | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulkEnabled = kind === "coupons";

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/resources/${kind}`).then(jsonResponse).then((result) => setItems(result.data)).catch((error: Error) => { setNotice(error.message); showToast(error.message, "error"); }).finally(() => setLoading(false));
  }, [kind, showToast]);

  const visible = useMemo(() => items.filter((item) => {
    const matchesSearch = !search || Object.values(item).some((value) => String(value).toLowerCase().includes(search.toLowerCase()));
    const current = item[config.filterField];
    const matchesFilter = filter === "All" || (config.filterField === "active" ? Boolean(current) === (filter === "Active") : current === filter);
    return matchesSearch && matchesFilter;
  }), [items, search, filter, config.filterField]);
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.id));

  useEffect(() => {
    setSelected((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))));
  }, [items]);

  function openNew() { setNotice(""); setEditor({ ...config.defaults }); }
  function openEdit(item: Item) { setNotice(""); setEditor({ ...item }); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setPending(true); setNotice("");
    try {
      const editing = Boolean(editor.id);
      const result = await jsonResponse(await fetch(`/api/admin/resources/${kind}`, {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editor),
      }));
      setItems((current) => editing ? current.map((item) => item.id === result.data.id ? result.data : item) : [result.data, ...current]);
      const message = `${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} ${editing ? "updated" : "created"} successfully.`;
      setEditor(null); setNotice(""); showToast(message);
    } catch (error) { setNotice(""); showToast((error as Error).message, "error"); }
    finally { setPending(false); }
  }

  async function remove(item: Item) {
    const label = String(item.title ?? item.name ?? item.code ?? config.singular);
    if (!await confirm({ title: `Delete ${config.singular}?`, description: `“${label}” will be permanently deleted. This cannot be undone.`, confirmLabel: `Delete ${config.singular}`, tone: "danger" })) return;
    try {
      await jsonResponse(await fetch(`/api/admin/resources/${kind}?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }));
      setItems((current) => current.filter((record) => record.id !== item.id));
      setSelected((current) => { const next = new Set(current); next.delete(item.id); return next; });
      setNotice(""); showToast(`${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} deleted.`);
    } catch (error) { setNotice(""); showToast((error as Error).message, "error"); }
  }

  function toggleSelected(id: string) {
    setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((item) => next.delete(item.id));
      else visible.forEach((item) => next.add(item.id));
      return next;
    });
  }

  async function removeSelected() {
    if (!selected.size || !await confirm({ title: `Delete ${selected.size} coupons?`, description: "The selected coupons will be permanently deleted. This cannot be undone.", confirmLabel: "Delete coupons", tone: "danger" })) return;
    const ids = [...selected];
    try {
      await jsonResponse(await fetch(`/api/admin/resources/${kind}?ids=${encodeURIComponent(ids.join(","))}`, { method: "DELETE" }));
      const deleted = new Set(ids);
      setItems((current) => current.filter((item) => !deleted.has(item.id)));
      setSelected(new Set());
      showToast(`${ids.length} coupons deleted successfully.`);
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  async function quickToggle(item: Item) {
    const field = kind === "coupons" ? "active" : kind === "templates" ? "enabled" : null;
    if (!field) return openEdit(item);
    try {
      const result = await jsonResponse(await fetch(`/api/admin/resources/${kind}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, [field]: !item[field] }) }));
      setItems((current) => current.map((record) => record.id === item.id ? result.data : record));
      showToast(`${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} status updated.`);
    } catch (error) { setNotice(""); showToast((error as Error).message, "error"); }
  }

  const activeCount = items.filter((item) => kind === "courses" ? item.status === "Published" : kind === "videos" ? item.status === "Ready" : kind === "coupons" ? item.active : item.enabled).length;
  return <>
    <Topbar title={config.title} subtitle={config.subtitle} action={<button className="primary-action" onClick={openNew}><Icons.plus /> {config.action}</button>} />
    <div className="page-content resource-page">
      <section className="resource-summary"><div><span>Total {kind}</span><strong>{items.length}</strong></div><div><span>{kind === "videos" ? "Ready" : kind === "courses" ? "Published" : "Active"}</span><strong>{activeCount}</strong></div><div><span>Last updated</span><strong>{items[0] ? new Date(items[0].updatedAt).toLocaleDateString() : "—"}</strong></div></section>
      {notice && <div className="resource-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      <section className="panel resource-panel">
        <div className="resource-toolbar"><label className="small-search"><Icons.search/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.search} /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{config.filterOptions.map((option) => <option key={option}>{option}</option>)}</select>{bulkEnabled && selected.size > 0 && <button className="secondary-action danger-action" onClick={removeSelected}>Delete selected ({selected.size})</button>}<button className="secondary-action" onClick={openNew}><Icons.plus /> {config.action}</button></div>
        {loading ? <div className="resource-empty">Loading {kind}…</div> : visible.length === 0 ? <div className="resource-empty"><strong>No {kind} found</strong><span>Adjust your search or create a new {config.singular}.</span></div> : <ResourceTable kind={kind} items={visible} onEdit={openEdit} onDelete={remove} onToggle={quickToggle} bulkEnabled={bulkEnabled} selected={selected} allSelected={allVisibleSelected} onToggleSelected={toggleSelected} onToggleAll={toggleAllVisible} />}
      </section>
    </div>
    {editor && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}><section className="resource-modal" role="dialog" aria-modal="true" aria-label={`${editor.id ? "Edit" : "Create"} ${config.singular}`}><header><div><small>{editor.id ? "Edit" : "Create"}</small><h2>{editor.id ? `Update ${config.singular}` : `New ${config.singular}`}</h2></div><button onClick={() => setEditor(null)} aria-label="Close">×</button></header><form onSubmit={save}><div className="resource-form-grid">{config.fields.map((field) => <ResourceField field={field} value={editor[field.name]} key={field.name} onChange={(value) => setEditor({ ...editor, [field.name]: value })} />)}</div><footer><button type="button" className="secondary-action" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="primary-action" disabled={pending}>{pending ? "Saving…" : editor.id ? "Save changes" : `Create ${config.singular}`}</button></footer></form></section></div>}
  </>;
}

function ResourceField({ field, value, onChange }: { field: Field; value: string | number | boolean | undefined; onChange: (value: string | number | boolean) => void }) {
  if (field.type === "checkbox") return <label className={`resource-checkbox ${field.wide ? "wide" : ""}`}><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span><strong>{field.label}</strong><small>Turn this option on or off.</small></span></label>;
  const common = { required: field.required, placeholder: field.placeholder, value: String(value ?? ""), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value) };
  return <label className={field.wide ? "wide" : ""}>{field.label}{field.type === "select" ? <select {...common}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea {...common} rows={6} /> : <input {...common} type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} />}</label>;
}

function ResourceTable({ kind, items, onEdit, onDelete, onToggle, bulkEnabled, selected, allSelected, onToggleSelected, onToggleAll }: { kind: ResourceKind; items: Item[]; onEdit: (item: Item) => void; onDelete: (item: Item) => void; onToggle: (item: Item) => void; bulkEnabled: boolean; selected: Set<string>; allSelected: boolean; onToggleSelected: (id: string) => void; onToggleAll: () => void }) {
  const headings = kind === "courses" ? ["Course", "Status", "Price", "Lessons", "Students"] : kind === "videos" ? ["Video", "Course", "Provider", "Duration", "Status"] : kind === "coupons" ? ["Coupon", "Discount", "Usage", "Valid until", "Status"] : ["Template", "Channel", "Subject", "Status", "Updated"];
  return <div className="table-wrap"><table className="resource-table"><thead><tr>{bulkEnabled && <th className="selection-cell"><input className="selection-checkbox" type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Select all visible coupons" /></th>}{headings.map((heading) => <th key={heading}>{heading}</th>)}<th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={selected.has(item.id) ? "selected-row" : ""}>{bulkEnabled && <td className="selection-cell"><input className="selection-checkbox" type="checkbox" checked={selected.has(item.id)} onChange={() => onToggleSelected(item.id)} aria-label={`Select ${String(item.code ?? configLabel(kind))}`} /></td>}{kind === "courses" ? <><td><span className="resource-primary"><i>{initials(String(item.title))}</i><span><strong>{item.title}</strong><small>{item.category}{item.featured ? " · Featured" : ""}</small></span></span></td><td><Status value={String(item.status)} /></td><td><strong>{money(Number(item.salePrice || item.price))}</strong><small className="muted-price">{item.salePrice ? money(Number(item.price)) : ""}</small></td><td>{item.lessons}</td><td>{Number(item.students).toLocaleString("en-IN")}</td></> : kind === "videos" ? <><td><span className="resource-primary"><i>▶</i><span><strong>{item.title}</strong><small>{item.sourceUrl}</small></span></span></td><td>{item.course || "Unassigned"}</td><td>{item.provider}</td><td>{item.durationMinutes} min</td><td><Status value={String(item.status)} /></td></> : kind === "coupons" ? <><td><span className="resource-primary"><i>%</i><span><strong>{item.code}</strong><small>{item.description}</small></span></span></td><td><strong>{item.discountType === "Percentage" ? `${item.discountValue}%` : money(Number(item.discountValue))}</strong></td><td>{item.used} / {item.usageLimit || "∞"}</td><td>{item.endsAt || "No expiry"}</td><td><button className={`toggle-pill ${item.active ? "on" : ""}`} onClick={() => onToggle(item)}>{item.active ? "Active" : "Inactive"}</button></td></> : <><td><span className="resource-primary"><i>{initials(String(item.name))}</i><span><strong>{item.name}</strong><small>{item.key}</small></span></span></td><td><Status value={String(item.channel)} /></td><td className="template-subject">{item.subject || "—"}</td><td><button className={`toggle-pill ${item.enabled ? "on" : ""}`} onClick={() => onToggle(item)}>{item.enabled ? "Enabled" : "Disabled"}</button></td><td>{new Date(item.updatedAt).toLocaleDateString()}</td></>}<td><div className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger" onClick={() => onDelete(item)}>Delete</button></div></td></tr>)}</tbody></table></div>;
}

function configLabel(kind: ResourceKind) { return kind.slice(0, -1); }

function Status({ value }: { value: string }) { return <span className={`resource-status status-${value.toLowerCase().replaceAll(" ", "-")}`}>{value}</span>; }
function money(value: number) { return `₹${value.toLocaleString("en-IN")}`; }
function initials(value: string) { return value.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase(); }
