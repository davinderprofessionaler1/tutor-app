"use client";

import { useEffect, useRef, useState } from "react";
import { Track, type Room } from "livekit-client";
import type { ClassroomStudent } from "@tutor/contracts";

function StudentVideo({ track, name }: { track: Track; name: string }) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    track.attach(node);
    return () => {
      track.detach(node);
    };
  }, [track]);
  // Student audio is attached once by the teacher classroom, never by each preview.
  return (
    <video
      ref={element}
      autoPlay
      playsInline
      muted
      aria-label={`${name} live video`}
    />
  );
}

type Moderation = {
  action: "permissions" | "end-student-session";
  identity?: string;
  studentId?: string;
  microphone?: boolean;
  camera?: boolean;
};
export function TeacherStudents({
  students,
  room,
  live,
  loading,
  moderate,
  refresh,
  teacher,
}: {
  students: ClassroomStudent[];
  room: Room | null;
  live: boolean;
  loading: boolean;
  moderate: (input: Moderation) => Promise<void>;
  refresh: () => Promise<void>;
  teacher: { name: string; camera?: Track; microphone: boolean };
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null),
    [ending, setEnding] = useState<ClassroomStudent | null>(null),
    [focused, setFocused] = useState<string | null>(null);
  const connected = students.filter((student) => student.connected).length;
  const values = students.filter(
    (student) =>
      `${student.name} ${student.email}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "connected" ? student.connected : student.sessionEnded)),
  );
  async function act(student: ClassroomStudent, input: Moderation) {
    setPending(student.id);
    try {
      await moderate(input);
    } finally {
      setPending(null);
    }
  }
  function camera(student: ClassroomStudent) {
    const participant = student.identity
      ? room?.remoteParticipants.get(student.identity)
      : undefined;
    const publication = participant?.getTrackPublication(Track.Source.Camera);
    return student.camera &&
      student.connected &&
      publication?.isSubscribed &&
      !publication.isMuted
      ? publication.track
      : undefined;
  }
  const selected = students.find((student) => student.id === focused),
    enlarged = selected ? camera(selected) : undefined;
  return (
    <section className="panel live-students" aria-label="Class students">
      <header className="live-students-header">
        <div>
          <h2>Classroom</h2>
          <p>
            Students · {students.length} · {connected} connected ·{" "}
            {students.length - connected} offline
          </p>
        </div>
        <button
          className="secondary-action"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Refresh students
        </button>
      </header>
      <p className="live-students-help">
        Allow camera or microphone access, then the student turns it on from
        their phone. Approved student audio plays here.
      </p>
      {room && !room.canPlaybackAudio && (
        <button
          className="primary-action"
          onClick={() => void room.startAudio()}
        >
          Enable student audio
        </button>
      )}
      <div className="live-students-filters">
        <input
          aria-label="Search class students"
          placeholder="Search students by name or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter class students"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All students</option>
          <option value="connected">Connected</option>
          <option value="ended">Session ended</option>
        </select>
      </div>
      {loading && !students.length && <p role="status">Loading students…</p>}
      {!loading && !values.length && <p>No students in this view.</p>}
      <div className="live-student-grid">
        <article className="live-student-card" aria-label="Your teacher video">
          <div className="live-student-video">
            {teacher.camera ? (
              <StudentVideo
                track={teacher.camera}
                name={`${teacher.name} (you)`}
              />
            ) : (
              <div className="live-student-placeholder">
                <strong>
                  {teacher.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </strong>
                <span>
                  {room ? "Your camera is off" : "Connect to the classroom"}
                </span>
              </div>
            )}
          </div>
          <div className="live-student-info">
            <strong>{teacher.name} · You</strong>
            <div className="live-student-status">
              <span>Teacher</span>
              <span>
                {teacher.microphone ? "Microphone on" : "Microphone off"}
              </span>
            </div>
          </div>
        </article>
        {values.map((student) => {
          const participant = student.identity
            ? room?.remoteParticipants.get(student.identity)
            : undefined;
          const video = camera(student);
          const microphone = participant?.getTrackPublication(
            Track.Source.Microphone,
          );
          const micOn =
            student.microphone &&
            Boolean(microphone?.track && !microphone.isMuted);
          const canControl =
            live &&
            student.connected &&
            !student.sessionEnded &&
            Boolean(student.identity) &&
            !pending;
          return (
            <article
              className="live-student-card"
              key={student.id}
              aria-label={`${student.name} student`}
            >
              <div className="live-student-video">
                {video ? (
                  <StudentVideo track={video} name={student.name} />
                ) : (
                  <div className="live-student-placeholder">
                    <strong>
                      {student.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </strong>
                    <span>
                      {student.sessionEnded
                        ? "Session ended"
                        : !student.connected
                          ? "Offline"
                          : student.camera
                            ? "Waiting for student camera"
                            : "Camera off"}
                    </span>
                  </div>
                )}
              </div>
              <div className="live-student-info">
                <strong>{student.name}</strong>
                <small>{student.email}</small>
                <div className="live-student-status">
                  <span>
                    {student.sessionEnded
                      ? "Session ended"
                      : student.connected
                        ? "Connected"
                        : "Offline"}
                  </span>
                  <span>
                    {micOn
                      ? participant?.isSpeaking
                        ? "Speaking"
                        : "Microphone on"
                      : student.microphone
                        ? "Mic allowed · off"
                        : "Mic not allowed"}
                  </span>
                  {student.raisedHand && <span>✋ Wants to speak</span>}
                </div>
                <div className="live-student-actions">
                  <button
                    className="secondary-action"
                    disabled={!canControl}
                    aria-label={`${student.name}: ${student.microphone ? "Revoke microphone" : "Allow microphone"}`}
                    onClick={() =>
                      void act(student, {
                        action: "permissions",
                        identity: student.identity!,
                        microphone: !student.microphone,
                        camera: student.camera,
                      })
                    }
                  >
                    {student.microphone
                      ? "Mute / revoke mic"
                      : "Allow microphone"}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={!canControl}
                    aria-label={`${student.name}: ${student.camera ? "Revoke camera" : "Allow camera"}`}
                    onClick={() =>
                      void act(student, {
                        action: "permissions",
                        identity: student.identity!,
                        microphone: student.microphone,
                        camera: !student.camera,
                      })
                    }
                  >
                    {student.camera ? "Revoke camera" : "Allow camera"}
                  </button>
                  {video && (
                    <button
                      className="secondary-action"
                      onClick={() => setFocused(student.id)}
                    >
                      Enlarge video
                    </button>
                  )}
                  <button
                    className="secondary-action live-end-student"
                    disabled={!live || student.sessionEnded || Boolean(pending)}
                    aria-label={`End ${student.name} session`}
                    onClick={() => setEnding(student)}
                  >
                    {pending === student.id
                      ? "Updating…"
                      : "End student session"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {ending && (
        <div className="modal-backdrop">
          <section
            className="resource-modal live-student-confirm"
            role="dialog"
            aria-modal="true"
            aria-label="End student session"
          >
            <header>
              <h2>End {ending.name}’s session?</h2>
            </header>
            <p>
              They will be disconnected and cannot rejoin this class. The class
              continues for everyone else.
            </p>
            <footer>
              <button
                className="secondary-action"
                onClick={() => setEnding(null)}
              >
                Keep in class
              </button>
              <button
                className="primary-action"
                onClick={() => {
                  const student = ending;
                  setEnding(null);
                  void act(student, {
                    action: "end-student-session",
                    studentId: student.id,
                  });
                }}
              >
                End student session
              </button>
            </footer>
          </section>
        </div>
      )}
      {selected && (
        <div className="modal-backdrop">
          <section
            className="resource-modal live-student-focus"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} video`}
          >
            <header>
              <h2>{selected.name}</h2>
              <button
                aria-label="Close student video"
                onClick={() => setFocused(null)}
              >
                ×
              </button>
            </header>
            {enlarged ? (
              <StudentVideo track={enlarged} name={selected.name} />
            ) : (
              <p>The student’s camera is off or their session has ended.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
