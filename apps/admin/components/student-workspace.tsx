"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icons } from "./icons";
import { Topbar } from "./topbar";
import { useToast } from "./toast";

type Course = { id: string; title: string; status: string };
type Student = { id: string; firstName: string; lastName: string; email: string; phone: string; status: "Active" | "Blocked"; courseIds: string[]; joinedAt: string; updatedAt: string };
const blankStudent = (): Omit<Student, "id" | "updatedAt"> => ({ firstName: "", lastName: "", email: "", phone: "", status: "Active", courseIds: [], joinedAt: new Date().toISOString().slice(0, 10) });

async function jsonResponse(response: Response) {
  const result = await response.json();
  if (response.status === 401) window.location.assign("/login?next=/students");
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

export function StudentWorkspace() {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [editor, setEditor] = useState<Partial<Student> | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    Promise.all(["students", "courses"].map((resource) => fetch(`/api/admin/resources/${resource}`).then(jsonResponse)))
      .then(([studentData, courseData]) => { setStudents(studentData.data); setCourses(courseData.data); })
      .catch((error: Error) => showToast(error.message, "error")).finally(() => setLoading(false));
  }, [showToast]);

  const visible = useMemo(() => students.filter((student) => {
    const matchesText = `${student.firstName} ${student.lastName} ${student.email} ${student.phone}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (filter === "All" || student.status === filter);
  }), [students, search, filter]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setPending(true);
    try {
      const result = await jsonResponse(await fetch("/api/admin/resources/students", { method: editor.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editor) }));
      setStudents((current) => editor.id ? current.map((student) => student.id === result.data.id ? result.data : student) : [result.data, ...current]);
      setEditor(null); showToast(`Student ${editor.id ? "updated" : "created"} successfully.`);
    } catch (error) { showToast((error as Error).message, "error"); }
    finally { setPending(false); }
  }

  async function updateStatus(student: Student) {
    const status = student.status === "Active" ? "Blocked" : "Active";
    if (status === "Blocked" && !window.confirm(`Block ${student.firstName} ${student.lastName}? They will be signed out of the mobile app and will not be able to log in.`)) return;
    try {
      const result = await jsonResponse(await fetch("/api/admin/resources/students", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...student, status }) }));
      setStudents((current) => current.map((item) => item.id === student.id ? result.data : item));
      showToast(`${student.firstName} is now ${status.toLowerCase()}.`, status === "Blocked" ? "info" : "success");
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  async function remove(student: Student) {
    if (!window.confirm(`Delete ${student.firstName} ${student.lastName}? This cannot be undone.`)) return;
    try {
      await jsonResponse(await fetch(`/api/admin/resources/students?id=${encodeURIComponent(student.id)}`, { method: "DELETE" }));
      setStudents((current) => current.filter((item) => item.id !== student.id)); showToast("Student deleted.");
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  function toggleCourse(courseId: string) {
    if (!editor) return;
    const selected = editor.courseIds ?? [];
    setEditor({ ...editor, courseIds: selected.includes(courseId) ? selected.filter((id) => id !== courseId) : [...selected, courseId] });
  }

  const active = students.filter((student) => student.status === "Active").length;
  const enrollments = students.reduce((total, student) => total + student.courseIds.length, 0);
  return <>
    <Topbar title="Students" subtitle="Manage learners, access, and course assignments." action={<button className="primary-action" onClick={() => setEditor(blankStudent())}><Icons.plus/> Add student</button>}/>
    <div className="page-content resource-page student-page">
      <section className="resource-summary"><div><span>Total students</span><strong>{students.length}</strong></div><div><span>Active students</span><strong>{active}</strong></div><div><span>Course assignments</span><strong>{enrollments}</strong></div></section>
      <section className="panel resource-panel"><div className="resource-toolbar"><label className="small-search"><Icons.search/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students"/></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Active</option><option>Blocked</option></select><button className="secondary-action" onClick={() => setEditor(blankStudent())}><Icons.plus/> Add student</button></div>
        {loading ? <div className="resource-empty">Loading students…</div> : <div className="table-wrap"><table className="resource-table student-table"><thead><tr><th>Student</th><th>Contact</th><th>Assigned courses</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map((student) => <tr key={student.id}><td><span className="student-name-cell"><i>{initials(student)}</i><span><strong>{student.firstName} {student.lastName}</strong><small>{student.email}</small></span></span></td><td>{student.phone || "—"}</td><td><div className="assignment-chips">{student.courseIds.length ? student.courseIds.slice(0, 2).map((id) => <span key={id}>{courses.find((course) => course.id === id)?.title ?? "Removed course"}</span>) : <small>Not assigned</small>}{student.courseIds.length > 2 && <b>+{student.courseIds.length - 2}</b>}</div></td><td>{formatDate(student.joinedAt)}</td><td><span className={`resource-status status-${student.status.toLowerCase()}`}>{student.status}</span></td><td><div className="row-actions"><button onClick={() => setEditor(structuredClone(student))}>Edit</button><button onClick={() => updateStatus(student)}>{student.status === "Active" ? "Block" : "Unblock"}</button><button className="danger" onClick={() => remove(student)}>Delete</button></div></td></tr>)}</tbody></table>{!visible.length && <div className="resource-empty"><strong>No students found</strong><span>Add a student or change the filter.</span></div>}</div>}
      </section>
    </div>
    {editor && <div className="modal-backdrop"><section className="resource-modal student-modal" role="dialog" aria-modal="true" aria-label="Student editor"><header><div><small>{editor.id ? "Edit student" : "Create student"}</small><h2>{editor.id ? `${editor.firstName} ${editor.lastName}` : "New student"}</h2></div><button onClick={() => setEditor(null)} aria-label="Close">×</button></header><form onSubmit={save}><div className="resource-form-grid"><label>First name<input required value={editor.firstName ?? ""} onChange={(event) => setEditor({ ...editor, firstName: event.target.value })}/></label><label>Last name<input required value={editor.lastName ?? ""} onChange={(event) => setEditor({ ...editor, lastName: event.target.value })}/></label><label>Email address<input type="email" required value={editor.email ?? ""} onChange={(event) => setEditor({ ...editor, email: event.target.value })}/></label><label>Phone number<input value={editor.phone ?? ""} onChange={(event) => setEditor({ ...editor, phone: event.target.value })}/></label><label>Joined date<input type="date" value={editor.joinedAt ?? ""} onChange={(event) => setEditor({ ...editor, joinedAt: event.target.value })}/></label><label>Status<select value={editor.status ?? "Active"} onChange={(event) => setEditor({ ...editor, status: event.target.value as Student["status"] })}><option>Active</option><option>Blocked</option></select></label></div><section className="student-course-picker"><header><h3>Assign courses</h3><span>{editor.courseIds?.length ?? 0} selected</span></header><div>{courses.map((course) => <label key={course.id}><input type="checkbox" checked={(editor.courseIds ?? []).includes(course.id)} onChange={() => toggleCourse(course.id)}/><span><strong>{course.title}</strong><small>{course.status}</small></span></label>)}</div></section><footer><button type="button" className="secondary-action" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="primary-action" disabled={pending}>{pending ? "Saving…" : "Save student"}</button></footer></form></section></div>}
  </>;
}

function initials(student: Pick<Student, "firstName" | "lastName">) { return `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase(); }
function formatDate(value: string) { if (!value) return "—"; return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
