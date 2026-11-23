"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./icons";
import { Topbar } from "./topbar";
import { useToast } from "./toast";
import { useActionDialog } from "./action-dialog";
import { formatBytes, uploadFile } from "../lib/upload-client";

type Video = { id: string; title: string; course: string; provider: string; sourceUrl: string; durationMinutes: number; status: string; downloadReady: boolean; updatedAt: string };
type Course = { id: string; title: string };
type SourceMode = "file" | "youtube" | "vimeo" | "cdn";
type UploadState = { percent: number; loaded: number; total: number } | null;
const blankVideo = (): Partial<Video> => ({ title: "", course: "", provider: "Uploaded file", sourceUrl: "", durationMinutes: 0, status: "Draft", downloadReady: false });

async function jsonResponse(response: Response) {
  const result = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

export function VideoWorkspace() {
  const { showToast } = useToast();
  const { confirm } = useActionDialog();
  const fileInput = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [editor, setEditor] = useState<Partial<Video> | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>("file");
  const [progress, setProgress] = useState<UploadState>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([fetch("/api/admin/resources/videos").then(jsonResponse), fetch("/api/admin/resources/courses").then(jsonResponse)])
      .then(([videoData, courseData]) => { setVideos(videoData.data); setCourses(courseData.data); })
      .catch((error: Error) => showToast(error.message, "error"));
  }, [showToast]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const visible = useMemo(() => videos.filter((video) => {
    const matches = `${video.title} ${video.course} ${video.provider}`.toLowerCase().includes(search.toLowerCase());
    return matches && (filter === "All" || video.status === filter);
  }), [videos, search, filter]);
  const allVisibleSelected = visible.length > 0 && visible.every((video) => selected.has(video.id));

  useEffect(() => { setSelected((current) => new Set([...current].filter((id) => videos.some((video) => video.id === id)))); }, [videos]);

  function openVideo(video?: Video) {
    setEditor(video ? { ...video } : blankVideo()); setProgress(null); setLocalPreview("");
    setSourceMode(video ? video.provider === "YouTube" ? "youtube" : video.provider === "Vimeo" ? "vimeo" : video.provider === "Uploaded file" ? "file" : "cdn" : "file");
  }

  function switchSource(mode: SourceMode) {
    if (!editor) return;
    const provider = mode === "youtube" ? "YouTube" : mode === "vimeo" ? "Vimeo" : mode === "cdn" ? "Custom CDN" : "Uploaded file";
    setSourceMode(mode); setProgress(null); setEditor({ ...editor, provider, sourceUrl: "" });
  }

  async function selectVideoFile(file?: File) {
    if (!file || !editor) return;
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file)); setProgress({ percent: 0, loaded: 0, total: file.size });
    if (!editor.title) setEditor((current) => current ? { ...current, title: file.name.replace(/\.[^.]+$/, "") } : current);
    try {
      const uploaded = await uploadFile(file, "video", (percent, loaded, total) => setProgress({ percent, loaded, total }));
      setEditor((current) => current ? { ...current, sourceUrl: uploaded.url, provider: "Uploaded file", status: "Ready" } : current);
      showToast("Video file uploaded successfully.");
    } catch (error) { setProgress(null); showToast((error as Error).message, "error"); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    if (!editor.sourceUrl) { showToast(sourceMode === "file" ? "Upload a video file first." : "Enter the video URL.", "error"); return; }
    setPending(true);
    try {
      const result = await jsonResponse(await fetch("/api/admin/resources/videos", { method: editor.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editor) }));
      setVideos((current) => editor.id ? current.map((video) => video.id === result.data.id ? result.data : video) : [result.data, ...current]);
      setEditor(null); showToast(`Video ${editor.id ? "updated" : "added"} successfully.`);
    } catch (error) { showToast((error as Error).message, "error"); }
    finally { setPending(false); }
  }

  async function remove(video: Video) {
    if (!await confirm({ title: "Delete video?", description: `“${video.title}” will also be removed from course chapters. This cannot be undone.`, confirmLabel: "Delete video", tone: "danger" })) return;
    try {
      await jsonResponse(await fetch(`/api/admin/resources/videos?id=${encodeURIComponent(video.id)}`, { method: "DELETE" }));
      setVideos((current) => current.filter((item) => item.id !== video.id));
      setSelected((current) => { const next = new Set(current); next.delete(video.id); return next; });
      showToast("Video deleted.");
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  function toggleSelected(id: string) {
    setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAllVisible() {
    setSelected((current) => { const next = new Set(current); visible.forEach((video) => allVisibleSelected ? next.delete(video.id) : next.add(video.id)); return next; });
  }

  async function removeSelected() {
    if (!selected.size || !await confirm({ title: `Delete ${selected.size} videos?`, description: "These videos will also be removed from course chapters. This cannot be undone.", confirmLabel: "Delete videos", tone: "danger" })) return;
    const ids = [...selected];
    try {
      await jsonResponse(await fetch(`/api/admin/resources/videos?ids=${encodeURIComponent(ids.join(","))}`, { method: "DELETE" }));
      const deleted = new Set(ids);
      setVideos((current) => current.filter((video) => !deleted.has(video.id)));
      setSelected(new Set());
      showToast(`${ids.length} videos deleted successfully.`);
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  return <>
    <Topbar title="Video library" subtitle="Upload video files or connect YouTube, Vimeo, and CDN sources." action={<button className="primary-action" onClick={() => openVideo()}><Icons.plus/> Add video</button>} />
    <div className="page-content resource-page"><section className="resource-summary"><div><span>Total videos</span><strong>{videos.length}</strong></div><div><span>Ready</span><strong>{videos.filter((video) => video.status === "Ready").length}</strong></div><div><span>Assigned</span><strong>{videos.filter((video) => video.course).length}</strong></div></section><section className="panel resource-panel"><div className="resource-toolbar"><label className="small-search"><Icons.search/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Ready</option><option>Processing</option><option>Draft</option><option>Failed</option></select><label className="select-all-control"><input className="selection-checkbox" type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /> Select all</label>{selected.size > 0 && <button className="secondary-action danger-action" onClick={removeSelected}>Delete selected ({selected.size})</button>}<button className="secondary-action" onClick={() => openVideo()}><Icons.plus/> Add video</button></div><div className="video-card-grid">{visible.map((video) => <article className={`video-card ${selected.has(video.id) ? "selected-row" : ""}`} key={video.id}><label className="video-select"><input className="selection-checkbox" type="checkbox" checked={selected.has(video.id)} onChange={() => toggleSelected(video.id)} aria-label={`Select ${video.title}`} /></label><div className="video-card-preview">{video.provider === "Uploaded file" && video.sourceUrl ? <video src={video.sourceUrl} preload="metadata" /> : <span>▶</span>}<b>{video.durationMinutes} min</b></div><div className="video-card-body"><span className="resource-status status-ready">{video.provider}</span><h3>{video.title}</h3><p>{video.course || "Not assigned to a course"}</p><footer><Status value={video.status}/><div className="row-actions"><button onClick={() => openVideo(video)}>Edit</button><button className="danger" onClick={() => remove(video)}>Delete</button></div></footer></div></article>)}</div>{!visible.length && <div className="resource-empty"><strong>No videos found</strong><span>Upload a file or add a hosted video link.</span></div>}</section></div>
    {editor && <div className="modal-backdrop"><section className="resource-modal video-modal" role="dialog" aria-modal="true" aria-label="Video editor"><header><div><small>{editor.id ? "Edit video" : "Add video"}</small><h2>{editor.title || "New video"}</h2></div><button onClick={() => setEditor(null)} aria-label="Close">×</button></header><form onSubmit={save}><div className="source-tabs"><button type="button" className={sourceMode === "file" ? "active" : ""} onClick={() => switchSource("file")}>Upload file</button><button type="button" className={sourceMode === "youtube" ? "active" : ""} onClick={() => switchSource("youtube")}>YouTube</button><button type="button" className={sourceMode === "vimeo" ? "active" : ""} onClick={() => switchSource("vimeo")}>Vimeo</button><button type="button" className={sourceMode === "cdn" ? "active" : ""} onClick={() => switchSource("cdn")}>Custom CDN</button></div>{sourceMode === "file" ? <div className="video-file-uploader"><input ref={fileInput} hidden type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" onChange={(event) => selectVideoFile(event.target.files?.[0])}/>{localPreview || editor.sourceUrl ? <video controls src={localPreview || editor.sourceUrl} preload="metadata" /> : <button type="button" onClick={() => fileInput.current?.click()}><span>↑</span><strong>Select a video file</strong><small>MP4, WebM, MOV, or MKV · Maximum 1 GB</small></button>}{(localPreview || editor.sourceUrl) && <button type="button" className="replace-file" onClick={() => fileInput.current?.click()}>Choose another file</button>}{progress && <UploadMeter progress={progress}/>}</div> : <label className="hosted-url">{sourceMode === "youtube" ? "YouTube URL" : sourceMode === "vimeo" ? "Vimeo URL" : "CDN video URL"}<input type="url" value={editor.sourceUrl ?? ""} onChange={(event) => setEditor({ ...editor, sourceUrl: event.target.value })} placeholder={sourceMode === "youtube" ? "https://youtube.com/watch?v=…" : sourceMode === "vimeo" ? "https://vimeo.com/…" : "https://cdn.example.com/video.mp4"} required /></label>}<div className="resource-form-grid video-details"><label className="wide">Video title<input value={editor.title ?? ""} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required /></label><label>Course<select value={editor.course ?? ""} onChange={(event) => setEditor({ ...editor, course: event.target.value })}><option value="">Not assigned</option>{courses.map((course) => <option key={course.id}>{course.title}</option>)}</select></label><label>Duration (minutes)<input type="number" min="0" value={editor.durationMinutes ?? 0} onChange={(event) => setEditor({ ...editor, durationMinutes: Number(event.target.value) })}/></label><label>Status<select value={editor.status ?? "Draft"} onChange={(event) => setEditor({ ...editor, status: event.target.value })}><option>Draft</option><option>Processing</option><option>Ready</option><option>Failed</option></select></label><label className="resource-checkbox"><input type="checkbox" checked={Boolean(editor.downloadReady)} onChange={(event) => setEditor({ ...editor, downloadReady: event.target.checked })}/><span><strong>Protected download</strong><small>Allow enrolled students to download this video.</small></span></label></div><footer><button type="button" className="secondary-action" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="primary-action" disabled={pending || Boolean(progress && progress.percent < 100)}>{pending ? "Saving…" : "Save video"}</button></footer></form></section></div>}
  </>;
}

function UploadMeter({ progress }: { progress: NonNullable<UploadState> }) { return <div className="upload-meter"><div><span style={{width:`${progress.percent}%`}}/></div><p><strong>{progress.percent}% uploaded</strong><span>{formatBytes(progress.loaded)} of {formatBytes(progress.total)}</span></p></div>; }
function Status({ value }: { value: string }) { return <span className={`resource-status status-${value.toLowerCase()}`}>{value}</span>; }
