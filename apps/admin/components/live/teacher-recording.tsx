"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { liveRequest } from "../../lib/live-client";

// Browser recording uses the already approved classroom media. It never opens
// another camera/microphone and does not require a paid recording service.
export function TeacherRecording({
  id,
  room,
  live,
  onActiveChange,
}: {
  id: string;
  room: Room | null;
  live: boolean;
  onActiveChange: (value: boolean) => void;
}) {
  const [consent, setConsent] = useState(false),
    [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [clip, setClip] = useState<Blob | null>(null),
    [saved, setSaved] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    cleanup = useRef<() => void>(() => {});
  const link = useRef<string | null>(null);
  useEffect(() => {
    onActiveChange(active);
    return () => onActiveChange(false);
  }, [active, onActiveChange]);
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup.current();
      if (link.current) URL.revokeObjectURL(link.current);
    },
    [],
  );
  useEffect(() => {
    if (!live || !room) {
      if (recorder.current?.state === "recording") recorder.current.stop();
    }
  }, [live, room]);
  async function start() {
    if (!room || !consent) return;
    setBusy(true);
    setError("");
    setSaved(false);
    let started = false;
    try {
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
        throw new Error(
          "Recording is unavailable in this browser. Upload an existing WebM or MP4 instead.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d")!;
      const audio = new AudioContext(),
        destination = audio.createMediaStreamDestination();
      // Keep the audio clock running even when every microphone is muted.
      // Chromium can otherwise wait forever for the silent destination track.
      const silence = audio.createConstantSource();
      silence.offset.value = 0;
      silence.connect(destination);
      silence.start();
      const sources = new Map<string, MediaStreamAudioSourceNode>();
      const draw = () => {
        context.fillStyle = "#131f25";
        context.fillRect(0, 0, 1280, 720);
        const stage =
          document.querySelector<HTMLVideoElement>(".live-stage video");
        const tiles = [
          ...document.querySelectorAll<HTMLVideoElement>(
            ".live-student-grid video",
          ),
        ];
        const videos = stage
          ? [stage, ...tiles.slice(0, 5)]
          : tiles.slice(0, 25);
        const paint = (
          video: HTMLVideoElement,
          x: number,
          y: number,
          w: number,
          h: number,
        ) => {
          if (video.readyState < 2 || !video.videoWidth) return;
          const scale = Math.min(
            w / video.videoWidth,
            (h - 24) / video.videoHeight,
          );
          context.drawImage(
            video,
            x + (w - video.videoWidth * scale) / 2,
            y,
            video.videoWidth * scale,
            video.videoHeight * scale,
          );
          context.fillStyle = "white";
          context.font = "14px sans-serif";
          context.fillText(
            video.getAttribute("aria-label")?.replace(" live video", "") ??
              "Teacher screen",
            x + 8,
            y + h - 8,
            w - 16,
          );
        };
        if (stage) {
          paint(stage, 0, 0, 1280, 580);
          tiles
            .slice(0, 5)
            .forEach((video, index) =>
              paint(video, index * 256, 580, 256, 140),
            );
        } else {
          const columns = Math.ceil(Math.sqrt(videos.length || 1)),
            rows = Math.ceil((videos.length || 1) / columns);
          videos.forEach((video, index) =>
            paint(
              video,
              (index % columns) * (1280 / columns),
              Math.floor(index / columns) * (720 / rows),
              1280 / columns,
              720 / rows,
            ),
          );
        }
        const tracks = [
          room.localParticipant,
          ...room.remoteParticipants.values(),
        ]
          .flatMap((participant) => [
            ...participant.audioTrackPublications.values(),
          ])
          .filter((publication) => publication.track && !publication.isMuted)
          .map((publication) => publication.track!.mediaStreamTrack);
        const present = new Set(tracks.map((track) => track.id));
        for (const [key, source] of sources)
          if (!present.has(key)) {
            source.disconnect();
            sources.delete(key);
          }
        for (const track of tracks)
          if (!sources.has(track.id)) {
            const source = audio.createMediaStreamSource(
              new MediaStream([track]),
            );
            source.connect(destination);
            sources.set(track.id, source);
          }
      };
      draw();
      const stream = canvas.captureStream(10);
      destination.stream
        .getAudioTracks()
        .forEach((track) => stream.addTrack(track));
      const timer = window.setInterval(draw, 100);
      let released = false;
      cleanup.current = () => {
        if (released) return;
        released = true;
        clearInterval(timer);
        silence.stop();
        silence.disconnect();
        sources.forEach((source) => source.disconnect());
        stream.getTracks().forEach((track) => track.stop());
        void audio.close().catch(() => undefined);
      };
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      if (!mimeType)
        throw new Error(
          "WebM recording is unavailable. Upload an MP4 recording instead.",
        );
      const next = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 450000,
        audioBitsPerSecond: 64000,
      });
      const parts: Blob[] = [];
      let size = 0;
      next.ondataavailable = (event) => {
        if (event.data.size) {
          parts.push(event.data);
          size += event.data.size;
        }
        if (size >= 90 * 1024 * 1024 && next.state === "recording") {
          setError(
            "Recording stopped at the 90 MB limit. Save this part before starting another.",
          );
          next.stop();
        }
      };
      next.onstop = () => {
        if (size) setClip(new Blob(parts, { type: "video/webm" }));
        else {
          setClip(null);
          setError(
            "The recording was empty. Start again and record for at least a few seconds.",
          );
        }
        setActive(false);
        cleanup.current();
        void liveRequest(`classes/${id}/moderate`, {
          action: "recording",
          enabled: false,
        }).catch(() => undefined);
      };
      next.onerror = () =>
        setError(
          "Recording failed. Keep this tab open and save any available clip.",
        );
      await audio.resume();
      await liveRequest(`classes/${id}/moderate`, {
        action: "recording",
        enabled: true,
      });
      started = true;
      recorder.current = next;
      setClip(null);
      next.start(1000);
      setActive(true);
    } catch (failure) {
      setError((failure as Error).message);
      cleanup.current();
      if (started)
        void liveRequest(`classes/${id}/moderate`, {
          action: "recording",
          enabled: false,
        }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: Blob) {
    setBusy(true);
    setError("");
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error("Recordings must be under 100 MB.");
      const response = await fetch(`/api/live/classes/${id}/recording`, {
        method: "POST",
        headers: { "Content-Type": file.type.split(";")[0] || "video/mp4" },
        body: file,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Upload failed. Your local clip is still available.",
        );
      setSaved(true);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel live-detail live-recording"
      aria-label="Class recording"
    >
      <h3>Class recording</h3>
      <p>
        Save a recording for enrolled students to download on their phones. Keep
        this tab open while recording. Up to 25 visible video tiles and approved
        audio are included; use an unfiltered gallery to include those students.
      </p>
      <label>
        <input
          type="checkbox"
          checked={consent}
          disabled={active}
          onChange={(event) => setConsent(event.target.checked)}
        />{" "}
        I have permission from participants to record and share this class with
        enrolled students.
      </label>
      <div className="live-student-actions">
        {active ? (
          <button
            className="primary-action"
            onClick={() => recorder.current?.stop()}
          >
            Stop recording
          </button>
        ) : (
          <button
            className="secondary-action"
            disabled={
              !live || !room || !consent || busy || Boolean(clip && !saved)
            }
            onClick={() => void start()}
          >
            Start recording
          </button>
        )}
        {clip && (
          <p>Recorded clip: {(clip.size / 1024 / 1024).toFixed(2)} MB</p>
        )}
        {clip && !active && (
          <>
            <button
              className="secondary-action"
              disabled={busy}
              onClick={() => {
                if (
                  !clip.size ||
                  window.confirm(
                    "Discard this local clip? Save it first if you want to keep it.",
                  )
                )
                  setClip(null);
              }}
            >
              Discard local clip
            </button>
            <button
              className="primary-action"
              disabled={busy}
              onClick={() => void upload(clip)}
            >
              {busy ? "Saving…" : "Save for student download"}
            </button>
            <button
              className="secondary-action"
              onClick={() => {
                if (link.current) URL.revokeObjectURL(link.current);
                link.current = URL.createObjectURL(clip);
                const anchor = document.createElement("a");
                anchor.href = link.current;
                anchor.download = "class-recording.webm";
                anchor.click();
              }}
            >
              Keep local copy
            </button>
          </>
        )}
        <label className="secondary-action">
          Upload recording
          <input
            aria-label="Upload class recording"
            type="file"
            accept="video/webm,video/mp4"
            disabled={active || busy || !consent}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {active && (
        <p role="status">
          ● Recording in progress. Students are notified in the app.
        </p>
      )}
      {saved && (
        <p role="status">
          Recording saved. Enrolled students can download it from class details.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
