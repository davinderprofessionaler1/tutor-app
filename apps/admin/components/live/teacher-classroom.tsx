"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteAudioTrack,
} from "livekit-client";
import type {
  ClassroomJoin,
  ClassroomSnapshot,
  ClassroomStudent,
  ClassroomAdmission,
  LiveClassView,
} from "@tutor/contracts";
import { TeacherRecording } from "./teacher-recording";
import { TeacherStudents } from "./teacher-students";
import { Topbar } from "../topbar";
import { useActionDialog } from "../action-dialog";
import { liveRequest, LiveRequestError } from "../../lib/live-client";

function Video({ track }: { track: Track }) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    track.attach(node);
    return () => {
      track.detach(node);
    };
  }, [track]);
  return <video ref={element} autoPlay playsInline muted />;
}
function Audio({ track }: { track: RemoteAudioTrack }) {
  const element = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    track.attach(node);
    return () => {
      track.detach(node);
    };
  }, [track]);
  return <audio ref={element} autoPlay />;
}

export function TeacherClassroom({ id }: { id: string }) {
  const { confirm } = useActionDialog();
  const [value, setValue] = useState<LiveClassView | null>(null),
    [room, setRoom] = useState<Room | null>(null);
  const [snapshot, setSnapshot] = useState<ClassroomSnapshot | null>(null),
    [connection, setConnection] = useState("Not connected");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const [, redraw] = useState(0);
  const [students, setStudents] = useState<ClassroomStudent[]>([]),
    [studentsLoading, setStudentsLoading] = useState(true);
  const [admission, setAdmission] = useState<ClassroomAdmission>({
    waitingRoom: false,
    locked: false,
    waiting: [],
  });
  const recordingActive = useRef(false);
  const recordingChanged = useCallback((active: boolean) => {
    recordingActive.current = active;
  }, []);
  const refreshStudents = useCallback(async () => {
    try {
      const [response, detail] = await Promise.all([
        liveRequest<{
          data: ClassroomStudent[];
          admission: ClassroomAdmission;
        }>(`classes/${id}/students`),
        liveRequest<{ data: LiveClassView }>(`classes/${id}`),
      ]);
      setValue(detail.data);
      setError("");
      setStudents(response.data);
      setAdmission(response.admission);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setStudentsLoading(false);
    }
  }, [id]);
  const session = useRef<ClassroomJoin | null>(null),
    activeRoom = useRef<Room | null>(null),
    polling = useRef(false),
    reconnectWanted = useRef(false),
    connecting = useRef(false),
    retries = useRef(0);
  const disconnect = useCallback(
    async (manual = true) => {
      if (manual) reconnectWanted.current = false;
      const old = session.current;
      session.current = null;
      await activeRoom.current?.disconnect();
      activeRoom.current = null;
      setRoom(null);
      setSnapshot(null);
      setConnection("Disconnected");
      if (old)
        await liveRequest(`classes/${id}/interact`, {
          action: "leave",
          ticketId: old.ticketId,
        }).catch(() => undefined);
    },
    [id],
  );
  const connect = useCallback(async () => {
    if (connecting.current) return;
    connecting.current = true;
    reconnectWanted.current = true;
    setBusy(true);
    setError("");
    try {
      if (activeRoom.current) await disconnect(false);
      const joined = await liveRequest<ClassroomJoin>(`classes/${id}/join`, {});
      // Use the established dual-PC signaling path across Chromium and Flutter clients.
      const next = new Room({
        adaptiveStream: true,
        dynacast: true,
        singlePeerConnection: false,
      });
      session.current = joined;
      activeRoom.current = next;
      setRoom(next);
      setConnection("Connecting");
      const refresh = () => redraw((revision) => revision + 1);
      next.on(RoomEvent.ConnectionStateChanged, (state) =>
        setConnection(state),
      );
      next
        .on(RoomEvent.TrackSubscribed, refresh)
        .on(RoomEvent.TrackUnsubscribed, refresh)
        .on(RoomEvent.LocalTrackPublished, refresh)
        .on(RoomEvent.LocalTrackUnpublished, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.ConnectionQualityChanged, refresh)
        .on(RoomEvent.ParticipantPermissionsChanged, refresh)
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.AudioPlaybackStatusChanged, refresh);
      await next.connect(joined.url, joined.token, { autoSubscribe: true });
      // Capture only when the teacher explicitly uses a media control.
      await next.startAudio().catch(() => undefined);
      retries.current = 0;
    } catch (failure) {
      setError((failure as Error).message);
      if (
        failure instanceof LiveRequestError &&
        failure.status &&
        failure.status < 500
      )
        reconnectWanted.current = false;
      await disconnect(false);
    } finally {
      connecting.current = false;
      setBusy(false);
    }
  }, [id, disconnect]);
  useEffect(() => {
    void refreshStudents();
  }, [refreshStudents]);
  useEffect(() => {
    const timer = setInterval(async () => {
      const joined = session.current;
      if (!joined) {
        void refreshStudents();
        return;
      }
      if (polling.current) return;
      polling.current = true;
      try {
        const response = await liveRequest<ClassroomSnapshot>(
          `classes/${id}/interact`,
          {
            action: "heartbeat",
            ticketId: joined.ticketId,
            recording: recordingActive.current,
          },
        );
        setSnapshot(response);
        if (response.students) setStudents(response.students);
        if (response.admission) setAdmission(response.admission);
      } catch (failure) {
        setError((failure as Error).message);
        if (
          failure instanceof LiveRequestError &&
          failure.status &&
          failure.status < 500 &&
          failure.status !== 429
        )
          await disconnect();
      } finally {
        polling.current = false;
      }
    }, 3000);
    return () => {
      clearInterval(timer);
      reconnectWanted.current = false;
      const joined = session.current;
      session.current = null;
      void activeRoom.current?.disconnect();
      if (joined)
        void liveRequest(`classes/${id}/interact`, {
          action: "leave",
          ticketId: joined.ticketId,
        }).catch(() => undefined);
    };
  }, [id, disconnect, refreshStudents]);
  useEffect(() => {
    const retry = setInterval(() => {
      if (
        reconnectWanted.current &&
        !connecting.current &&
        (!activeRoom.current ||
          activeRoom.current.state === ConnectionState.Disconnected)
      ) {
        if (++retries.current > 5) {
          reconnectWanted.current = false;
          setError(
            "Connection could not be restored. Use Reconnect to try again.",
          );
          return;
        }
        setConnection("Reconnecting");
        void connect();
      }
    }, 5000);
    return () => clearInterval(retry);
  }, [connect]);
  useEffect(() => {
    const tick = () =>
      setElapsed(
        value?.startedAt
          ? Math.max(
              0,
              Math.floor((Date.now() - Date.parse(value.startedAt)) / 1000),
            )
          : 0,
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [value?.startedAt]);
  async function control(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      redraw((revision) => revision + 1);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  async function moderate(body: unknown) {
    await control(async () => {
      const response = await liveRequest<{
        disconnectPending?: boolean;
        muted?: number;
        pending?: number;
      }>(`classes/${id}/moderate`, body);
      await refreshStudents();
      if (response.pending)
        setError(
          `${response.pending} microphone updates are being retried. Students have been asked to mute.`,
        );
      if (response.disconnectPending)
        setError(
          "Student access has ended. Disconnecting their previous connection is being retried.",
        );
    });
  }
  const local = room?.localParticipant;
  const publications = [...(local?.videoTrackPublications.values() ?? [])];
  const screen = publications.find(
    (publication) =>
      publication.source === Track.Source.ScreenShare && !publication.isMuted,
  )?.track;
  const camera = publications.find(
    (publication) =>
      publication.source === Track.Source.Camera && !publication.isMuted,
  )?.track;
  const audio = [...(room?.remoteParticipants.values() ?? [])]
    .filter((participant) =>
      students.some(
        (student) =>
          student.identity === participant.identity &&
          student.connected &&
          student.microphone &&
          !student.sessionEnded,
      ),
    )
    .flatMap((participant) => [...participant.audioTrackPublications.values()])
    .map((publication) => publication.track)
    .filter((track): track is RemoteAudioTrack => Boolean(track));
  return (
    <>
      <Topbar
        title={value?.title ?? "Live classroom"}
        subtitle={`${value?.teacherName ?? "Teacher"} · ${value?.courseTitle || "Individual session"}`}
        action={
          <Link className="secondary-action" href="/live-classes">
            Back to classes
          </Link>
        }
      />
      <div className="page-content live-module">
        {error && (
          <div role="alert" className="live-room-error">
            {error}
          </div>
        )}
        <div className="live-connection">
          <span>{value?.status ?? "Loading"}</span>
          <span>Connection: {connection}</span>
          <span>Network: {local?.connectionQuality ?? "unknown"}</span>
          <span>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
          <span>{snapshot?.participants.length ?? 0} connected</span>
        </div>
        <div className="live-room">
          <section>
            {screen && (
              <div className="live-stage">
                <Video track={screen} />
                <small>Screen share</small>
              </div>
            )}
            {!room && (
              <div className="live-stage-placeholder">
                <h2>{value?.title ?? "Your classroom"}</h2>
                <p>
                  {room
                    ? "Your camera is off. Turn it on or share your screen when you are ready."
                    : "Connect to the classroom to begin teaching."}
                </p>
                {!room && value?.status === "Live" && (
                  <button
                    className="primary-action"
                    disabled={busy}
                    onClick={() => void connect()}
                  >
                    {busy ? "Connecting…" : "Enter classroom"}
                  </button>
                )}
              </div>
            )}
            {audio.map((track) => (
              <Audio key={track.sid} track={track} />
            ))}
            <div className="live-controls">
              <button
                className="secondary-action"
                disabled={!local?.permissions?.canPublish}
                aria-pressed={local?.isCameraEnabled ?? false}
                onClick={() =>
                  void control(async () => {
                    await local?.setCameraEnabled(!local.isCameraEnabled);
                  })
                }
              >
                {local?.isCameraEnabled ? "Camera on" : "Camera off"}
              </button>
              <button
                className="secondary-action"
                disabled={!local?.permissions?.canPublish}
                aria-pressed={local?.isMicrophoneEnabled ?? false}
                onClick={() =>
                  void control(async () => {
                    await local?.setMicrophoneEnabled(
                      !local.isMicrophoneEnabled,
                    );
                  })
                }
              >
                {local?.isMicrophoneEnabled
                  ? "Microphone on"
                  : "Microphone off"}
              </button>
              <button
                className="secondary-action"
                disabled={!local?.permissions?.canPublish}
                aria-pressed={local?.isScreenShareEnabled ?? false}
                onClick={() =>
                  void control(async () => {
                    await local?.setScreenShareEnabled(
                      !local.isScreenShareEnabled,
                    );
                  })
                }
              >
                {local?.isScreenShareEnabled ? "Stop sharing" : "Share screen"}
              </button>
              {room && (
                <button
                  className="secondary-action"
                  onClick={() => void disconnect()}
                >
                  Leave classroom
                </button>
              )}
              {!room && value?.status === "Live" && (
                <button
                  className="secondary-action"
                  disabled={busy}
                  onClick={() => void connect()}
                >
                  Reconnect
                </button>
              )}
              {value?.status === "Live" && (
                <button
                  className="primary-action"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !await confirm({
                        title: "End class for everyone?",
                        description: "Students will be disconnected and cannot rejoin this session.",
                        confirmLabel: "End class",
                        cancelLabel: "Keep teaching",
                        tone: "danger",
                      })
                    )
                      return;
                    setBusy(true);
                    await control(async () => {
                      await liveRequest(`classes/${id}/end`, {});
                      await disconnect();
                      setError("");
                      await refreshStudents();
                      setValue((current) =>
                        current ? { ...current, status: "Completed" } : null,
                      );
                    });
                    setBusy(false);
                  }}
                >
                  End class
                </button>
              )}
            </div>
            <TeacherStudents
              admission={admission}
              students={students}
              room={room}
              live={value?.status === "Live"}
              loading={studentsLoading}
              moderate={moderate}
              refresh={refreshStudents}
              teacher={{
                name: value?.teacherName ?? "Teacher",
                camera,
                microphone: local?.isMicrophoneEnabled ?? false,
              }}
            />
            <TeacherRecording
              onActiveChange={recordingChanged}
              id={id}
              room={room}
              live={value?.status === "Live"}
            />
            <section className="panel live-detail">
              <h3>Class instructions</h3>
              <p>{value?.instructions || "No additional instructions."}</p>
              <Link className="live-link" href="/live-classes">
                Enrollment and attendance reports
              </Link>
            </section>
          </section>
          <aside className="live-room-aside">
            <section className="panel">
              <h2>Class chat</h2>
              <div className="live-chat">
                <button
                  className="secondary-action"
                  disabled={!room}
                  onClick={() =>
                    void moderate({
                      action: "chat",
                      enabled: !snapshot?.chatEnabled,
                    })
                  }
                >
                  {snapshot?.chatEnabled ? "Pause chat" : "Enable chat"}
                </button>
                <div className="live-chat-log" role="log" aria-live="polite">
                  {snapshot?.messages.map((item) => (
                    <p key={item.id}>
                      <strong>{item.name}</strong>
                      <br />
                      {item.text}
                      <br />
                      <button
                        className="text-action"
                        onClick={() =>
                          void moderate({
                            action: "hide-message",
                            messageId: item.id,
                          })
                        }
                      >
                        Hide message
                      </button>
                    </p>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const joined = session.current;
                    if (!joined || !message.trim()) return;
                    void control(async () => {
                      setSnapshot(
                        await liveRequest<ClassroomSnapshot>(
                          `classes/${id}/interact`,
                          {
                            action: "chat",
                            ticketId: joined.ticketId,
                            text: message,
                          },
                        ),
                      );
                      setMessage("");
                    });
                  }}
                >
                  <input
                    aria-label="Chat message"
                    maxLength={1000}
                    placeholder="Message your class"
                    disabled={!room || !snapshot?.chatEnabled}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <button
                    className="primary-action"
                    disabled={!room || !snapshot?.chatEnabled}
                  >
                    Send
                  </button>
                </form>
              </div>
            </section>
          </aside>
        </div>
        {room?.state === ConnectionState.Reconnecting && (
          <p role="status">Reconnecting to the classroom…</p>
        )}
      </div>
    </>
  );
}
