"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "./topbar";
import { useToast } from "./toast";

type Course = { id: string; title: string; status: string; students: number; salePrice: number; price: number };
type Video = { id: string; status: string; provider: string };
type Student = { id: string; firstName: string; lastName: string; email: string; status: "Active" | "Blocked"; courseIds: string[]; joinedAt: string };
type SecurityEvent = { id: string; studentName: string; studentEmail: string; eventType: "screenshot" | "screen_recording"; videoTitle: string; detectedAt: string; read: boolean };

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
  const [courses, setCourses] = useState<Course[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  useEffect(() => {
    Promise.all([readResource("courses"), readResource("videos"), readResource("students"), readSecurityEvents()])
      .then(([courseData, videoData, studentData, eventData]) => { setCourses(courseData); setVideos(videoData); setStudents(studentData); setSecurityEvents(eventData); })
      .catch((error: Error) => showToast(error.message, "error"));
  }, [showToast]);
  useEffect(() => {
    const timer = window.setInterval(() => readSecurityEvents().then(setSecurityEvents).catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function markAlertsRead() {
    const response = await fetch("/api/admin/security-events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: securityEvents.filter((event) => !event.read).map((event) => event.id) }) });
    const result = await response.json();
    if (!response.ok) return showToast(result.error ?? "Could not update security alerts.", "error");
    setSecurityEvents((events) => events.map((event) => ({ ...event, read: true })));
    showToast(result.message, "success");
  }

  const activeStudents = students.filter((student) => student.status === "Active").length;
  const enrollments = students.reduce((total, student) => total + student.courseIds.length, 0);
  const published = courses.filter((course) => course.status === "Published").length;
  const readyVideos = videos.filter((video) => video.status === "Ready").length;
  const unreadSecurityEvents = securityEvents.filter((event) => !event.read).length;
  const topCourses = useMemo(() => courses.map((course) => ({ ...course, assigned: students.filter((student) => student.courseIds.includes(course.id)).length })).sort((a, b) => b.assigned - a.assigned).slice(0, 5), [courses, students]);
  const recent = useMemo(() => [...students].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 6), [students]);
  const metrics = [
    ["Active students", activeStudents, `${students.length - activeStudents} blocked`, "coral"],
    ["Course assignments", enrollments, `Across ${courses.length} courses`, "green"],
    ["Published courses", published, `${courses.length - published} draft or archived`, "violet"],
    ["Ready videos", readyVideos, `${videos.filter((video) => video.provider === "YouTube").length} from YouTube`, "gold"],
  ] as const;

  return <>
    <Topbar title="Learning dashboard" subtitle="Live student, enrolment, course, and video activity." notificationCount={unreadSecurityEvents}/>
    <div className="dashboard-content">
      <section className="metric-grid">{metrics.map(([label, value, detail, tone], index) => <article className={`metric-card metric-${tone}`} key={label}><header><span>{label}</span><i>{["↟", "◫", "C", "▶"][index]}</i></header><strong>{value.toLocaleString("en-IN")}</strong><footer><b>Live</b><span>{detail}</span></footer></article>)}</section>
      <section className="panel security-alerts" id="security-alerts">
        <header className="panel-header"><div><h2>Video capture security alerts</h2><p>Screenshot and screen-recording activity reported by supported Android devices</p></div>{unreadSecurityEvents > 0 && <button className="secondary-action" onClick={markAlertsRead}>Mark all read</button>}</header>
        {securityEvents.length ? <div className="security-alert-list">{securityEvents.slice(0, 12).map((event) => <article className={event.read ? "" : "unread"} key={event.id}><span className="security-alert-icon">!</span><div><strong>{event.studentName} · {event.eventType === "screenshot" ? "Screenshot detected" : "Screen recording detected"}</strong><small>{event.studentEmail} · {event.videoTitle}</small></div><time dateTime={event.detectedAt}>{new Date(event.detectedAt).toLocaleString("en-IN")}</time></article>)}</div> : <div className="resource-empty"><strong>No video capture alerts</strong><span>Detected screenshot or screen-recording activity will appear here.</span></div>}
      </section>
      <section className="dashboard-grid dashboard-learning-grid">
        <article className="panel transactions"><header className="panel-header"><div><h2>Latest students</h2><p>New learners and their assigned courses</p></div><a className="text-button" href="/students">Manage students →</a></header><div className="table-wrap"><table><thead><tr><th>Student</th><th>Assigned courses</th><th>Access</th><th>Joined</th></tr></thead><tbody>{recent.map((student) => <tr key={student.id}><td><span className="student-avatar">{initials(student)}</span><span className="dashboard-student"><strong>{student.firstName} {student.lastName}</strong><small>{student.email}</small></span></td><td><div className="dashboard-course-list">{student.courseIds.length ? student.courseIds.slice(0, 2).map((id) => <span key={id}>{courses.find((course) => course.id === id)?.title ?? "Removed course"}</span>) : <small>No course assigned</small>}{student.courseIds.length > 2 && <b>+{student.courseIds.length - 2}</b>}</div></td><td><span className={`resource-status status-${student.status.toLowerCase()}`}>{student.status}</span></td><td>{student.joinedAt || "—"}</td></tr>)}</tbody></table>{!recent.length && <div className="resource-empty"><strong>No students yet</strong><span>Create a student and assign a course to see them here.</span></div>}</div></article>
        <article className="panel popular"><header className="panel-header"><div><h2>Top assigned courses</h2><p>Based on student assignments</p></div></header>{topCourses.map((course, index) => <div className="popular-row" key={course.id}><span>{index + 1}</span><i className="thumb thumb-blue">{course.title.split(" ").map((word) => word[0]).slice(0, 2).join("")}</i><div><strong>{course.title}</strong><small>{course.assigned} student{course.assigned === 1 ? "" : "s"} assigned</small></div><b>{course.status}</b></div>)}</article>
      </section>
    </div>
  </>;
}

function initials(student: Pick<Student, "firstName" | "lastName">) { return `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase(); }
