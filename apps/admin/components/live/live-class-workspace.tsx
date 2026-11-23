"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { LiveClassView } from "@tutor/contracts";
import { Icons } from "../icons";
import { useModalFocus } from "../use-modal-focus";
import { Topbar } from "../topbar";
import { useToast } from "../toast";
import { useActionDialog } from "../action-dialog";
import { uploadFile } from "../../lib/upload-client";
import {
  liveMoney,
  liveRequest,
  localInput,
  zonedIso,
} from "../../lib/live-client";

type Course = { id: string; title: string; price: number; salePrice: number };
type StudentReport = {
  classId: string;
  classTitle: string;
  name: string;
  email: string;
  enrollmentType: string;
  paymentStatus: string;
  joinedAt: string | null;
  leftAt: string | null;
  durationSeconds: number;
  connected: boolean;
};
type Report = {
  classes: number;
  upcoming: number;
  completed: number;
  paidEnrollments: number;
  courseEnrollments: number;
  revenue: number;
  students: StudentReport[];
  orders: {
    id: string;
    studentName: string;
    classTitle: string;
    kind: string;
    status: string;
    amount: number;
    refundRequired: boolean;
    refundedAmount: number;
  }[];
  audit: { id: string; type: string; detail: string; createdAt: string }[];
};
type Editor = {
  id?: string;
  title: string;
  description: string;
  objectives: string;
  instructions: string;
  courseId: string;
  thumbnailUrl: string;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  capacity: number;
  price: number;
  enrollmentDeadline: string;
  accessType: "individual" | "course" | "both";
  status: "Draft" | "Scheduled";
};

export function LiveClassWorkspace() {
  const { showToast } = useToast();
  const { confirm } = useActionDialog();
  const [classes, setClasses] = useState<LiveClassView[]>([]),
    [courses, setCourses] = useState<Course[]>([]);
  const [teacher, setTeacher] = useState(""),
    [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState("Classes"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("All statuses");
  const [editor, setEditor] = useState<Editor | null>(null),
    [details, setDetails] = useState<LiveClassView | null>(null);
  const [classReport, setClassReport] = useState<Report | null>(null),
    [reportTitle, setReportTitle] = useState("");
  const [pending, setPending] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [setup, setSetup] = useState({
    videoConfigured: false,
    paymentsConfigured: false,
  });
  const thumbnail = useRef<HTMLInputElement>(null);
  const newHandled = useRef(false);
  useModalFocus(Boolean(editor), () => setEditor(null));
  useEffect(() => {
    if (!loading && !newHandled.current && new URLSearchParams(window.location.search).get("new") === "1") { newHandled.current = true; edit(); }
  }, [loading]);
  useEffect(() => {
    const create = () => edit();
    window.addEventListener("admin-create-live-class", create);
    return () => window.removeEventListener("admin-create-live-class", create);
  }, []);
  const load = useCallback(async () => {
    try {
      const [list, summary] = await Promise.all([
        liveRequest<{
          data: LiveClassView[];
          courses: Course[];
          teacher: { name: string };
          infrastructure: typeof setup;
        }>("classes"),
        liveRequest<Report>("reports"),
      ]);
      setClasses(list.data);
      setCourses(list.courses);
      setTeacher(list.teacher.name);
      setSetup(list.infrastructure);
      setReport(summary);
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);
  function edit(value?: LiveClassView) {
    const timeZone = value?.timeZone ?? "Asia/Kolkata";
    setEditor({
      id: value?.id,
      title: value?.title ?? "",
      description: value?.description ?? "",
      objectives: value?.objectives ?? "",
      instructions: value?.instructions ?? "",
      courseId: value?.courseId ?? "",
      thumbnailUrl: value?.thumbnailUrl ?? "",
      startsAt: localInput(
        value?.startsAt ?? new Date(Date.now() + 86400000).toISOString(),
        timeZone,
      ),
      timeZone,
      durationMinutes: value?.durationMinutes ?? 60,
      capacity: value?.capacity ?? 30,
      price: (value?.price ?? 0) / 100,
      enrollmentDeadline: value?.enrollmentDeadline
        ? localInput(value.enrollmentDeadline, timeZone)
        : "",
      accessType: value?.accessType ?? "individual",
      status: value?.status === "Scheduled" ? "Scheduled" : "Draft",
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setPending(true);
    try {
      const { id, ...fields } = editor;
      await liveRequest(
        `classes${id ? `/${id}` : ""}`,
        {
          ...fields,
          courseId: fields.courseId || null,
          startsAt: zonedIso(fields.startsAt, fields.timeZone),
          enrollmentDeadline: fields.enrollmentDeadline
            ? zonedIso(fields.enrollmentDeadline, fields.timeZone)
            : null,
          price: Math.round(fields.price * 100),
        },
        id ? "PATCH" : "POST",
      );
      setEditor(null);
      await load();
      showToast("Live class saved.");
    } catch (failure) {
      showToast((failure as Error).message, "error");
    } finally {
      setPending(false);
    }
  }
  async function action(value: LiveClassView, kind: "start" | "cancel") {
    if (
      kind === "cancel" &&
      !await confirm({
        title: "Cancel live class?",
        description: `“${value.title}”: students will lose session access. Captured payments will be flagged for refund review.`,
        confirmLabel: "Cancel class",
        cancelLabel: "Keep class",
        tone: "danger",
      })
    )
      return;
    setPending(true);
    try {
      await liveRequest(`classes/${value.id}/${kind}`, {});
      await load();
      if (kind === "start") window.location.assign(`/live-classes/${value.id}`);
      else showToast("Class cancelled.");
    } catch (failure) {
      showToast((failure as Error).message, "error");
    } finally {
      setPending(false);
    }
  }
  async function attendance(value: LiveClassView) {
    try {
      setClassReport(await liveRequest<Report>(`classes/${value.id}/report`));
      setReportTitle(value.title);
    } catch (failure) {
      showToast((failure as Error).message, "error");
    }
  }
  function exportAttendance(values: StudentReport[]) {
    const cell = (value: unknown) =>
      `"${String(value ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      [
        "Class",
        "Student",
        "Email",
        "Access",
        "Payment",
        "Joined",
        "Left",
        "Attendance seconds",
        "Connected",
      ],
      ...values.map((value) => [
        value.classTitle,
        value.name,
        value.email,
        value.enrollmentType,
        value.paymentStatus,
        value.joinedAt,
        value.leftAt,
        value.durationSeconds,
        value.connected,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(cell).join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "live-class-attendance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  const filtered = classes.filter(
    (value) =>
      `${value.title} ${value.courseTitle} ${value.teacherName}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "All statuses" || value.status === status),
  );
  const studentTable = (values: StudentReport[]) => (
    <div className="table-scroll">
      <table className="resource-table live-table">
        <thead>
          <tr>
            {[
              "Student",
              "Class / access",
              "Payment",
              "Join / leave",
              "Attendance",
              "Connection",
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((student, index) => (
            <tr key={`${student.classId}-${index}`}>
              <td>
                <strong>{student.name}</strong>
                <small className="table-subtext">{student.email}</small>
              </td>
              <td>
                {student.classTitle}
                <small className="table-subtext">
                  {student.enrollmentType === "course"
                    ? "Course package"
                    : "Individual class"}
                </small>
              </td>
              <td>{student.paymentStatus}</td>
              <td>
                {student.joinedAt
                  ? new Date(student.joinedAt).toLocaleString()
                  : "Not joined"}
                <small className="table-subtext">
                  {student.leftAt
                    ? new Date(student.leftAt).toLocaleString()
                    : "—"}
                </small>
              </td>
              <td>
                {Math.floor(student.durationSeconds / 60)}m{" "}
                {student.durationSeconds % 60}s
              </td>
              <td>{student.connected ? "Connected" : "Offline"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!values.length && (
        <div className="resource-empty">No enrollments or attendance yet.</div>
      )}
    </div>
  );
  return (
    <>
      <Topbar
        title="Live Classes Management"
        subtitle="Schedule sessions, teach live and follow student attendance."
        action={
          <button className="primary-action" onClick={() => edit()}>
            <Icons.plus /> Schedule Class
          </button>
        }
      />
      <div className="page-content resource-page live-module">
        <div className="resource-summary live-summary">
          {[
            ["Upcoming classes", report?.upcoming ?? 0],
            [
              "Live now",
              classes.filter((value) => value.status === "Live").length,
            ],
            ["Course enrollments", report?.courseEnrollments ?? 0],
            ["Live class revenue", liveMoney(report?.revenue ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="workspace-tabs">
          {["Classes", "Course packages", "Reports"].map((name) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {error && (
          <div className="resource-notice" role="alert">
            {error}
            <button onClick={() => void load()} aria-label="Retry loading">
              ↻
            </button>
          </div>
        )}
        {!loading && !setup.videoConfigured && (
          <div className="resource-notice">
            Live video setup is pending. You can create and schedule classes
            now; starting a classroom becomes available after setup.
          </div>
        )}
        {tab === "Classes" && (
          <section className="panel resource-panel">
            <div className="resource-toolbar">
              <label className="small-search">
                <Icons.search />
                <input
                  aria-label="Search live classes"
                  placeholder="Search classes, courses or teachers"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                aria-label="Filter live class status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {[
                  "All statuses",
                  "Draft",
                  "Scheduled",
                  "Live",
                  "Completed",
                  "Cancelled",
                ].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <button className="secondary-action" onClick={() => void load()}>
                Refresh
              </button>
            </div>
            <div className="table-scroll">
              <table className="resource-table live-table">
                <thead>
                  <tr>
                    {[
                      "Class / teacher",
                      "Course",
                      "Schedule",
                      "Price",
                      "Students",
                      "Status",
                      "Actions",
                    ].map((name) => (
                      <th key={name}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((value) => (
                    <tr key={value.id}>
                      <td>
                        <div className="resource-primary">
                          {value.thumbnailUrl ? (
                            <img
                              className="live-thumb"
                              src={value.thumbnailUrl}
                              alt=""
                            />
                          ) : (
                            <i>
                              <Icons.video />
                            </i>
                          )}
                          <span>
                            <strong>{value.title}</strong>
                            <small>{value.teacherName}</small>
                          </span>
                        </div>
                      </td>
                      <td>{value.courseTitle || "Individual session"}</td>
                      <td>
                        {new Date(value.startsAt).toLocaleString("en-IN", {
                          timeZone: value.timeZone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        <small className="table-subtext">
                          {value.timeZone} · {value.durationMinutes} min
                        </small>
                      </td>
                      <td>
                        {value.accessType === "course"
                          ? "Included in course"
                          : value.price
                            ? liveMoney(value.price)
                            : "Free"}
                      </td>
                      <td>
                        {value.enrollmentCount} / {value.capacity}
                      </td>
                      <td>
                        <span
                          className={`resource-status live-status-${value.status.toLowerCase()}`}
                        >
                          {value.status}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions live-row-actions">
                          <button onClick={() => setDetails(value)}>
                            View
                          </button>
                          {["Draft", "Scheduled"].includes(value.status) && (
                            <button onClick={() => edit(value)}>Edit</button>
                          )}
                          {value.status === "Scheduled" && (
                            <button
                              disabled={pending || !setup.videoConfigured}
                              onClick={() => void action(value, "start")}
                            >
                              Start
                            </button>
                          )}
                          {value.status === "Live" && (
                            <Link
                              className="live-link"
                              href={`/live-classes/${value.id}`}
                            >
                              Open classroom
                            </Link>
                          )}
                          <button onClick={() => void attendance(value)}>
                            Students / attendance
                          </button>
                          {["Draft", "Scheduled", "Live"].includes(
                            value.status,
                          ) && (
                            <button
                              className="danger"
                              disabled={pending}
                              onClick={() => void action(value, "cancel")}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="resource-empty">
                <strong>
                  {loading
                    ? "Loading live classes…"
                    : "Your live classroom starts here"}
                </strong>
                <p>
                  Create a session, choose its course and schedule, then invite
                  your students.
                </p>
                {!loading && (
                  <button className="primary-action" onClick={() => edit()}>
                    Create your first class
                  </button>
                )}
              </div>
            )}
          </section>
        )}
        {tab === "Course packages" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Live sessions in your existing courses</h2>
                <p>
                  Course pricing and ownership come from course management.
                  Included sessions unlock together.
                </p>
              </div>
              <Link className="secondary-action" href="/courses">
                Manage courses
              </Link>
            </div>
            <div className="live-packages">
              {courses.map((course) => {
                const sessions = classes.filter(
                  (value) =>
                    value.courseId === course.id &&
                    value.accessType !== "individual",
                );
                return (
                  <article key={course.id}>
                    <div>
                      <h3>{course.title}</h3>
                      <p>
                        {liveMoney(
                          Math.round((course.salePrice ?? course.price) * 100),
                        )}{" "}
                        · {sessions.length} included sessions
                      </p>
                    </div>
                    <button
                      className="secondary-action"
                      onClick={() => {
                        edit();
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                courseId: course.id,
                                accessType: "course",
                              }
                            : null,
                        );
                      }}
                    >
                      Add session
                    </button>
                    {sessions.map((value) => (
                      <p key={value.id}>
                        {value.title} ·{" "}
                        {new Date(value.startsAt).toLocaleDateString()} ·{" "}
                        {value.status}
                      </p>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>
        )}
        {tab === "Reports" && report && (
          <>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Enrollment and attendance</h2>
                  <p>
                    {report.completed} completed classes ·{" "}
                    {report.paidEnrollments} paid purchases ·{" "}
                    {report.courseEnrollments} course enrollments
                  </p>
                </div>
                <button
                  className="secondary-action"
                  onClick={() => exportAttendance(report.students)}
                >
                  Export attendance
                </button>
              </div>
              {studentTable(report.students)}
            </section>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Payments and refunds</h2>
                  <p>
                    {setup.paymentsConfigured
                      ? "Razorpay payments are verified by the server."
                      : "Razorpay merchant setup is pending."}
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="resource-table live-table">
                  <thead>
                    <tr>
                      {[
                        "Student",
                        "Class",
                        "Purchase",
                        "Amount",
                        "Status",
                        "Refund",
                      ].map((name) => (
                        <th key={name}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.orders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.studentName}</td>
                        <td>{order.classTitle}</td>
                        <td>
                          {order.kind === "course"
                            ? "Course package"
                            : "Individual class"}
                        </td>
                        <td>{liveMoney(order.amount)}</td>
                        <td>
                          {order.status}
                          {order.refundRequired && (
                            <small className="table-subtext">
                              Cancelled class · refund review required
                            </small>
                          )}
                        </td>
                        <td>
                          {order.status === "Paid" &&
                          order.refundedAmount === 0 ? (
                            <button
                              className="secondary-action"
                              onClick={async () => {
                                if (
                                  !await confirm({
                                    title: "Request full refund?",
                                    description: `Submit a full ${liveMoney(order.amount)} Razorpay refund for ${order.studentName}?`,
                                    confirmLabel: "Request refund",
                                    tone: "danger",
                                  })
                                )
                                  return;
                                try {
                                  await liveRequest(
                                    `orders/${order.id}/refund`,
                                    {},
                                  );
                                  showToast(
                                    "Refund submitted for provider confirmation.",
                                  );
                                  await load();
                                } catch (failure) {
                                  showToast(
                                    (failure as Error).message,
                                    "error",
                                  );
                                }
                              }}
                            >
                              Request refund
                            </button>
                          ) : (
                            liveMoney(order.refundedAmount)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!report.orders.length && (
                  <div className="resource-empty">
                    No live-class payments yet.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
        {editor && (
          <div className="modal-backdrop">
            <section
              className="resource-modal live-editor"
              role="dialog"
              aria-modal="true"
              aria-label={editor.id ? "Edit live class" : "Create live class"}
            >
              <header>
                <div>
                  <small>Live classroom</small>
                  <h2>{editor.id ? "Edit Live Class" : "Schedule New Live Class"}</h2>
                </div>
                <button
                  aria-label="Close class editor"
                  onClick={() => setEditor(null)}
                >
                  ×
                </button>
              </header>
              <form onSubmit={save}>
                <div className="resource-form-grid">
                  <label className="wide">
                    Class title
                    <input
                      required
                      minLength={3}
                      maxLength={160}
                      value={editor.title}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, title: event.target.value }
                            : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Teacher
                    <input readOnly value={teacher} />
                  </label>
                  <label>
                    Associated course
                    <select
                      value={editor.courseId}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, courseId: event.target.value }
                            : null,
                        )
                      }
                    >
                      <option value="">No course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wide">
                    Description
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={editor.description}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, description: event.target.value }
                            : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Date and start time
                    <input
                      required
                      type="datetime-local"
                      onInput={(event) => {
                        const value = event.currentTarget.value;
                        setEditor((current) =>
                          current ? { ...current, startsAt: value } : null,
                        );
                      }}
                      value={editor.startsAt}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, startsAt: event.target.value }
                            : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Time zone
                    <input
                      required
                      list="live-time-zones"
                      value={editor.timeZone}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, timeZone: event.target.value }
                            : null,
                        )
                      }
                    />
                    <datalist id="live-time-zones">
                      {[
                        "Asia/Kolkata",
                        "UTC",
                        "Europe/London",
                        "America/New_York",
                        "America/Los_Angeles",
                        "Asia/Dubai",
                        "Asia/Singapore",
                        "Australia/Sydney",
                      ].map((zone) => (
                        <option key={zone}>{zone}</option>
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Duration (minutes)
                    <input
                      required
                      type="number"
                      min={5}
                      max={480}
                      value={editor.durationMinutes}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                durationMinutes: Number(event.target.value),
                              }
                            : null,
                        )
                      }
                    />
                  </label>
                  <div className="calculated-end" aria-live="polite"><strong>Calculated end time</strong><br />{classEndTime(editor)}</div>
                  <label>
                    Maximum students
                    <input
                      required
                      type="number"
                      min={1}
                      max={100}
                      value={editor.capacity}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                capacity: Number(event.target.value),
                              }
                            : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Access type
                    <select
                      value={editor.accessType}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                accessType: event.target
                                  .value as Editor["accessType"],
                              }
                            : null,
                        )
                      }
                    >
                      <option value="individual">Individual class</option>
                      <option value="course">
                        Included in purchased course
                      </option>
                      <option value="both">Individual and course access</option>
                    </select>
                  </label>
                  <label>
                    Individual class price (₹)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editor.price}
                      disabled={editor.accessType === "course"}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, price: Number(event.target.value) }
                            : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Enrollment deadline
                    <input
                      type="datetime-local"
                      onInput={(event) => {
                        const value = event.currentTarget.value;
                        setEditor((current) =>
                          current
                            ? { ...current, enrollmentDeadline: value }
                            : null,
                        );
                      }}
                      value={editor.enrollmentDeadline}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                enrollmentDeadline: event.target.value,
                              }
                            : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={editor.status}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                status: event.target.value as Editor["status"],
                              }
                            : null,
                        )
                      }
                    >
                      <option>Draft</option>
                      <option>Scheduled</option>
                    </select>
                  </label>
                  <label className="wide">
                    Thumbnail URL
                    <input
                      value={editor.thumbnailUrl}
                      placeholder="https://… or upload a thumbnail"
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, thumbnailUrl: event.target.value }
                            : null,
                        )
                      }
                    />
                    <input
                      ref={thumbnail}
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setPending(true);
                        try {
                          const uploaded = await uploadFile(
                            file,
                            "thumbnail",
                            () => undefined,
                          );
                          setEditor((current) =>
                            current
                              ? { ...current, thumbnailUrl: uploaded.url }
                              : null,
                          );
                        } catch (failure) {
                          showToast((failure as Error).message, "error");
                        } finally {
                          setPending(false);
                        }
                      }}
                    />
                    <button
                      className="secondary-action"
                      type="button"
                      onClick={() => thumbnail.current?.click()}
                    >
                      Upload thumbnail
                    </button>
                  </label>
                  <label className="wide">
                    Learning objectives
                    <textarea
                      rows={2}
                      maxLength={3000}
                      value={editor.objectives}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, objectives: event.target.value }
                            : null,
                        )
                      }
                    />
                  </label>
                  <label className="wide">
                    Class instructions
                    <textarea
                      rows={2}
                      maxLength={3000}
                      value={editor.instructions}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, instructions: event.target.value }
                            : null,
                        )
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => setEditor(null)}
                  >
                    Close
                  </button>
                  <button className="primary-action" disabled={pending}>
                    {pending ? "Saving…" : "Save live class"}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}
        {details && (
          <div className="modal-backdrop">
            <section
              className="resource-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Class details"
            >
              <header>
                <div>
                  <small>{details.status}</small>
                  <h2>{details.title}</h2>
                </div>
                <button
                  onClick={() => setDetails(null)}
                  aria-label="Close details"
                >
                  ×
                </button>
              </header>
              <div className="live-detail">
                <p>{details.description || "No description added."}</p>
                <dl>
                  <dt>Teacher</dt>
                  <dd>{details.teacherName}</dd>
                  <dt>Schedule</dt>
                  <dd>
                    {new Date(details.startsAt).toLocaleString("en-IN", {
                      timeZone: details.timeZone,
                    })}{" "}
                    · {details.timeZone}
                  </dd>
                  <dt>Duration</dt>
                  <dd>{details.durationMinutes} minutes</dd>
                  <dt>Seats</dt>
                  <dd>
                    {details.enrollmentCount} / {details.capacity}
                  </dd>
                  <dt>Access</dt>
                  <dd>
                    {details.accessType} · {details.courseTitle || "No course"}
                  </dd>
                </dl>
                <h3>Learning objectives</h3>
                <p>{details.objectives || "—"}</p>
                <h3>Instructions</h3>
                <p>{details.instructions || "—"}</p>
                <button
                  className="secondary-action"
                  onClick={() => {
                    void attendance(details);
                    setDetails(null);
                  }}
                >
                  View students and attendance
                </button>
              </div>
            </section>
          </div>
        )}
        {classReport && (
          <div className="modal-backdrop">
            <section
              className="resource-modal live-report-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Class attendance"
            >
              <header>
                <div>
                  <small>Students and attendance</small>
                  <h2>{reportTitle}</h2>
                </div>
                <button
                  onClick={() => setClassReport(null)}
                  aria-label="Close attendance"
                >
                  ×
                </button>
              </header>
              <div className="live-detail">
                <button
                  className="secondary-action"
                  onClick={() => exportAttendance(classReport.students)}
                >
                  Export attendance CSV
                </button>
              </div>
              {studentTable(classReport.students)}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function classEndTime(editor: Editor) {
  try {
    if (!editor.startsAt || editor.durationMinutes <= 0) return "Choose a start time and duration.";
    const end = new Date(new Date(zonedIso(editor.startsAt, editor.timeZone)).getTime() + editor.durationMinutes * 60000);
    return `${new Intl.DateTimeFormat("en-IN", { timeZone: editor.timeZone, dateStyle: "medium", timeStyle: "short" }).format(end)} · ${editor.timeZone}`;
  } catch { return "Choose a valid date and time zone."; }
}
