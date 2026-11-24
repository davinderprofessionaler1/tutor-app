"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Topbar } from "./topbar";
import { Icons } from "./icons";
import { useToast } from "./toast";
import { liveRequest } from "../lib/live-client";
import type { LiveClassView } from "@tutor/contracts";

type Course = { id: string; title: string; status: string; students: number; salePrice: number; price: number };
type Video = { id: string; status: string; provider: string };
type Student = { id: string; firstName: string; lastName: string; email: string; status: "Active" | "Blocked"; courseIds: string[]; joinedAt: string };
type SecurityEvent = { id: string; studentName: string; studentEmail: string; eventType: "screenshot" | "screen_recording"; videoTitle: string; detectedAt: string; read: boolean };
type ClassroomSetup = { videoConfigured: boolean; paymentsConfigured: boolean };
async function readResource(name: string) {
  const response = await fetch(`/api/admin/resources/${name}`);
  if (response.status === 401) { window.location.assign("/login"); throw new Error("Please sign in again."); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load dashboard data.");
  return result.data;
}
async function readSecurityEvents() {
  const response = await fetch("/api/admin/security-events");
  if (response.status === 401) { window.location.assign("/login"); throw new Error("Please sign in again."); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load security alerts.");
  return result.data as SecurityEvent[];
}
export function DashboardWorkspace() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]), [videos, setVideos] = useState<Video[]>([]), [students, setStudents] = useState<Student[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [classes, setClasses] = useState<LiveClassView[]>([]), [setup, setSetup] = useState<ClassroomSetup | null>(null);
  const [loading, setLoading] = useState(true), [liveError, setLiveError] = useState("");
  const [name, setName] = useState(""), [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const hour = new Date().getHours(); setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
    Promise.all([readResource("courses"), readResource("videos"), readResource("students"), readSecurityEvents()])
      .then(([courseData, videoData, studentData, eventData]) => { setCourses(courseData); setVideos(videoData); setStudents(studentData); setSecurityEvents(eventData); })
      .catch((error: Error) => showToast(error.message, "error")).finally(() => setLoading(false));
    fetch("/api/admin/profile").then(async (response) => { if (response.ok) setName((await response.json()).profile.firstName); }).catch(() => undefined);
    const refreshLive = () => liveRequest<{data: LiveClassView[]; infrastructure: ClassroomSetup}>("classes").then((result) => { setClasses(result.data); setSetup(result.infrastructure); setLiveError(""); }).catch(() => setLiveError("Live sessions could not be loaded. Open Live Classes to retry."));
    void refreshLive();
    const timer = window.setInterval(() => { readSecurityEvents().then(setSecurityEvents).catch(() => undefined); void refreshLive(); }, 15000);
    return () => window.clearInterval(timer);
  }, [showToast]);
  async function markAlertsRead() {
    const response = await fetch("/api/admin/security-events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: securityEvents.filter((event) => !event.read).map((event) => event.id) }) });
    const result = await response.json();
    if (!response.ok) return showToast(result.error ?? "Could not update security alerts.", "error");
    setSecurityEvents((events) => events.map((event) => ({ ...event, read: true })));
    window.dispatchEvent(new Event("admin-security-updated")); showToast(result.message, "success");
  }
  const active = students.filter((student) => student.status === "Active").length;
  const assignments = students.reduce((sum, student) => sum + student.courseIds.length, 0);
  const published = courses.filter((course) => course.status === "Published").length;
  const unread = securityEvents.filter((event) => !event.read).length;
  const topCourses = useMemo(() => courses.map((course) => ({ ...course, assigned: students.filter((student) => student.courseIds.includes(course.id)).length })).filter((course) => course.assigned > 0).sort((a, b) => b.assigned - a.assigned).slice(0, 5), [courses, students]);
  const recent = useMemo(() => [...students].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 6), [students]);
  const sessions = [...classes].filter((value) => value.status === "Live" || value.status === "Scheduled" && new Date(value.startsAt).getTime() >= Date.now()).sort((a, b) => a.status === "Live" && b.status !== "Live" ? -1 : b.status === "Live" && a.status !== "Live" ? 1 : a.startsAt.localeCompare(b.startsAt)).slice(0, 4);
  const liveCount = classes.filter((value) => value.status === "Live").length;
  const metrics = [
    { label: "Active students", value: active, detail: `${students.length} total · ${students.length - active} blocked`, Icon: Icons.students },
    { label: "Published courses", value: published, detail: `${videos.filter((video) => video.status === "Ready").length} ready videos · ${assignments} assignments`, Icon: Icons.courses },
    { label: "Live sessions", value: liveCount, detail: `${classes.filter((value) => value.status === "Scheduled").length} scheduled sessions`, Icon: Icons.video },
    { label: "Capture alerts", value: unread, detail: "Unread Android capture reports", Icon: Icons.content },
  ];
  return <>
    <Topbar eyebrow="Learning operations console" title={`${greeting}${name ? `, ${name}` : ""}.`} subtitle="Here is what is happening across Northstar today." action={<div className="quick-actions"><Link href="/students?new=1" className="secondary-action"><Icons.students /> Add Student</Link><Link href="/courses?new=1" className="secondary-action"><Icons.courses /> Create Course</Link><Link href="/live-classes?new=1" className="primary-action"><Icons.plus /> Schedule Class</Link></div>} />
    <div className="dashboard-content">
      <section className="metric-grid" aria-label="Platform overview" aria-busy={loading}>{metrics.map(({ label, value, detail, Icon }, index) => <article className={`metric-card ${index === 3 ? "metric-security" : ""}`} key={label}><header><span>{label}</span><i><Icon /></i></header><strong>{loading ? "—" : value.toLocaleString("en-IN")}</strong><footer><span>{detail}</span></footer></article>)}</section>
      <section className="panel security-alerts" id="security-alerts"><header className="panel-header"><div className="security-heading"><span><Icons.content /></span><div><h2>Android Screen Capture Alerts</h2><p>Screenshot and screen-recording reports from supported student devices</p></div></div>{unread > 0 && <button className="secondary-action" onClick={markAlertsRead}>Mark All Read ({unread})</button>}</header>
        {securityEvents.length ? <div className="security-alert-list">{securityEvents.slice(0, 12).map((event) => <article className={event.read ? "" : "unread"} key={event.id}><span className="security-alert-icon">!</span><div><strong>{event.studentName} · {event.eventType === "screenshot" ? "Screenshot detected" : "Screen recording detected"}</strong><small>{event.studentEmail} · {event.videoTitle}</small></div><time dateTime={event.detectedAt}>{new Date(event.detectedAt).toLocaleString("en-IN")}</time></article>)}</div> : <div className="resource-empty"><strong>{loading ? "Loading capture alerts…" : "No video capture alerts"}</strong><span>Device-reported capture events will appear here.</span></div>}
      </section>
      <section className="dashboard-grid dashboard-learning-grid"><div className="dashboard-stack">
        <article className="panel"><header className="panel-header"><div><h2>Live & Upcoming Sessions</h2><p>Your classrooms, schedules and enrolled students</p></div><Link className="text-button" href="/live-classes">View all →</Link></header><div className="session-list">{liveError ? <div className="resource-notice">{liveError}</div> : sessions.length ? sessions.map((value) => <article className={`session-preview ${value.status === "Live" ? "is-live" : ""}`} key={value.id}><i><Icons.video /></i><div><span className={`resource-status live-status-${value.status.toLowerCase()}`}>{value.status}</span><h3>{value.title}</h3><p>{new Date(value.startsAt).toLocaleString("en-IN", { timeZone: value.timeZone, dateStyle: "medium", timeStyle: "short" })} · {value.timeZone}</p><p>{value.teacherName} · {value.durationMinutes} min · {value.enrollmentCount} enrolled</p></div><Link className={value.status === "Live" ? "primary-action" : "secondary-action"} href={value.status === "Live" ? `/live-classes/${value.id}` : "/live-classes"}>{value.status === "Live" ? "Open classroom" : "View session"}</Link></article>) : <div className="resource-empty"><strong>{setup ? "No upcoming sessions" : "Loading live sessions…"}</strong><Link className="text-button" href="/live-classes?new=1">Schedule your first class →</Link></div>}</div></article>
        <article className="panel transactions"><header className="panel-header"><div><h2>Recent Students & Assignments</h2><p>Student accounts and their current course access</p></div><Link className="text-button" href="/students">Manage students →</Link></header><div className="table-wrap"><table><thead><tr><th>Student</th><th>Assigned courses</th><th>Joined</th><th>Status</th></tr></thead><tbody>{recent.map((student) => <tr key={student.id}><td><span className="dashboard-student"><strong>{student.firstName} {student.lastName}</strong><small>{student.email}</small></span></td><td><div className="dashboard-course-list">{student.courseIds.length ? student.courseIds.slice(0, 2).map((id) => <span key={id}>{courses.find((course) => course.id === id)?.title ?? "Removed course"}</span>) : <small>No course assigned</small>}{student.courseIds.length > 2 && <b>+{student.courseIds.length - 2}</b>}</div></td><td>{student.joinedAt || "—"}</td><td><span className={`resource-status status-${student.status.toLowerCase()}`}>{student.status}</span></td></tr>)}</tbody></table>{!recent.length && <div className="resource-empty">{loading ? "Loading students…" : "No students yet. Add a student to get started."}</div>}</div></article>
      </div><div className="dashboard-stack"><article className="panel"><header className="panel-header"><div><h2>Most-Assigned Courses</h2><p>Based on existing student assignments</p></div></header><div className="assignment-rank">{topCourses.map((course) => <article key={course.id}><div><strong>{course.title}</strong><b>{course.assigned} {course.assigned === 1 ? "student" : "students"}</b></div><div className="academic-progress"><span style={{ width: `${students.length ? course.assigned / students.length * 100 : 0}%` }} /></div><small>{course.status}</small></article>)}{!topCourses.length && <p className="resource-empty">No course assignments yet.</p>}<Link href="/courses" className="secondary-action">View All Courses →</Link></div></article>
        <article className="panel"><header className="panel-header"><div><h2>Classroom Configuration</h2><p>Current integration setup</p></div></header><div className="configuration-list"><div><span>Live video</span><span className={`resource-status ${setup?.videoConfigured ? "status-active" : "status-draft"}`}>{setup ? setup.videoConfigured ? "Configured" : "Setup needed" : "Checking"}</span></div><div><span>Razorpay checkout</span><span className={`resource-status ${setup?.paymentsConfigured ? "status-active" : "status-draft"}`}>{setup ? setup.paymentsConfigured ? "Configured" : "Setup needed" : "Checking"}</span></div><p>Configuration status does not indicate a provider health check.</p><Link className="text-button" href="/live-classes">Open Live Classes →</Link></div></article>
      </div></section>
    </div>
  </>;
}
