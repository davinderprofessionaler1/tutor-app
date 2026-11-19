"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./icons";
import { Topbar } from "./topbar";
import { useToast } from "./toast";
import { formatBytes, uploadFile } from "../lib/upload-client";

type Category = { id: string; name: string; slug: string; description: string; active: boolean; updatedAt: string };
type Video = { id: string; title: string; course: string; provider: string; status: string; durationMinutes: number };
type Chapter = { id: string; title: string; videoIds: string[] };
type Attachment = { id: string; name: string; url: string; sizeBytes: number; mimeType: string };
type Course = { id: string; title: string; category: string; categoryId: string; thumbnailUrl: string; attachments: Attachment[]; chapters: Chapter[]; status: string; price: number; salePrice: number; lessons: number; students: number; featured: boolean; updatedAt: string };
type UploadProgress = { percent: number; loaded: number; total: number } | null;

const emptyCourse = (): Omit<Course, "id" | "updatedAt"> => ({ title: "", category: "", categoryId: "", thumbnailUrl: "", attachments: [], chapters: [], status: "Draft", price: 0, salePrice: 0, lessons: 0, students: 0, featured: false });
const emptyCategory = { name: "", slug: "", description: "", active: true };

async function jsonResponse(response: Response) {
  const result = await response.json();
  if (response.status === 401) window.location.assign("/login");
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result;
}

export function CourseWorkspace() {
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"courses" | "categories">("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Partial<Course> | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<Partial<Category> | null>(null);
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(null);
  const [instantPreview, setInstantPreview] = useState("");
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all(["courses", "categories", "videos"].map((resource) => fetch(`/api/admin/resources/${resource}`).then(jsonResponse)))
      .then(([courseData, categoryData, videoData]) => { setCourses(courseData.data); setCategories(categoryData.data); setVideos(videoData.data); })
      .catch((error: Error) => showToast(error.message, "error"));
  }, [showToast]);

  useEffect(() => () => { if (instantPreview) URL.revokeObjectURL(instantPreview); }, [instantPreview]);

  const filteredCourses = useMemo(() => courses.filter((course) => `${course.title} ${course.category} ${course.status}`.toLowerCase().includes(search.toLowerCase())), [courses, search]);
  const activeCategories = categories.filter((category) => category.active);
  const allCoursesSelected = filteredCourses.length > 0 && filteredCourses.every((course) => selectedCourses.has(course.id));
  const allCategoriesSelected = categories.length > 0 && categories.every((category) => selectedCategories.has(category.id));

  useEffect(() => { setSelectedCourses((current) => new Set([...current].filter((id) => courses.some((course) => course.id === id)))); }, [courses]);
  useEffect(() => { setSelectedCategories((current) => new Set([...current].filter((id) => categories.some((category) => category.id === id)))); }, [categories]);

  function openCourse(course?: Course) {
    setInstantPreview(""); setUploadProgress(null);
    setEditor(course ? structuredClone(course) : { ...emptyCourse(), categoryId: activeCategories[0]?.id ?? "", category: activeCategories[0]?.name ?? "" });
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const category = categories.find((item) => item.id === editor.categoryId);
    const payload = { ...editor, category: category?.name ?? "", lessons: (editor.chapters ?? []).reduce((total, chapter) => total + chapter.videoIds.length, 0) };
    setPending(true);
    try {
      const result = await jsonResponse(await fetch("/api/admin/resources/courses", { method: editor.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      setCourses((current) => editor.id ? current.map((course) => course.id === result.data.id ? result.data : course) : [result.data, ...current]);
      setEditor(null); showToast(`Course ${editor.id ? "updated" : "created"} successfully.`);
    } catch (error) { showToast((error as Error).message, "error"); }
    finally { setPending(false); }
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`Delete ${course.title}? This cannot be undone.`)) return;
    try {
      await jsonResponse(await fetch(`/api/admin/resources/courses?id=${encodeURIComponent(course.id)}`, { method: "DELETE" }));
      setCourses((current) => current.filter((item) => item.id !== course.id));
      setSelectedCourses((current) => { const next = new Set(current); next.delete(course.id); return next; });
      showToast("Course deleted successfully.");
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  async function chooseThumbnail(file?: File) {
    if (!file || !editor) return;
    if (instantPreview) URL.revokeObjectURL(instantPreview);
    setInstantPreview(URL.createObjectURL(file));
    setUploadProgress({ percent: 0, loaded: 0, total: file.size });
    try {
      const uploaded = await uploadFile(file, "thumbnail", (percent, loaded, total) => setUploadProgress({ percent, loaded, total }));
      setEditor((current) => current ? { ...current, thumbnailUrl: uploaded.url } : current);
      showToast("Course thumbnail uploaded.");
    } catch (error) { setUploadProgress(null); showToast((error as Error).message, "error"); }
  }

  async function chooseAttachment(file?: File) {
    if (!file || !editor) return;
    setAttachmentUploading(true);
    try {
      const uploaded = await uploadFile(file, "attachment", () => undefined);
      const attachment: Attachment = { id: crypto.randomUUID(), name: uploaded.fileName, url: uploaded.url, sizeBytes: uploaded.size, mimeType: uploaded.contentType };
      setEditor((current) => current ? { ...current, attachments: [...(current.attachments ?? []), attachment] } : current);
      showToast("Course attachment uploaded.");
    } catch (error) { showToast((error as Error).message, "error"); }
    finally { setAttachmentUploading(false); }
  }

  function addChapter() {
    if (!editor) return;
    const chapters = editor.chapters ?? [];
    setEditor({ ...editor, chapters: [...chapters, { id: crypto.randomUUID(), title: `Chapter ${chapters.length + 1}`, videoIds: [] }] });
  }

  function updateChapter(id: string, change: Partial<Chapter>) {
    if (!editor) return;
    setEditor({ ...editor, chapters: (editor.chapters ?? []).map((chapter) => chapter.id === id ? { ...chapter, ...change } : chapter) });
  }

  function toggleChapterVideo(chapter: Chapter, videoId: string) {
    updateChapter(chapter.id, { videoIds: chapter.videoIds.includes(videoId) ? chapter.videoIds.filter((id) => id !== videoId) : [...chapter.videoIds, videoId] });
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryEditor) return;
    setPending(true);
    try {
      const result = await jsonResponse(await fetch("/api/admin/resources/categories", { method: categoryEditor.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(categoryEditor) }));
      setCategories((current) => categoryEditor.id ? current.map((category) => category.id === result.data.id ? result.data : category) : [result.data, ...current]);
      setCategoryEditor(null); showToast(`Category ${categoryEditor.id ? "updated" : "created"} successfully.`);
    } catch (error) { showToast((error as Error).message, "error"); }
    finally { setPending(false); }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    try {
      await jsonResponse(await fetch(`/api/admin/resources/categories?id=${encodeURIComponent(category.id)}`, { method: "DELETE" }));
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setSelectedCategories((current) => { const next = new Set(current); next.delete(category.id); return next; });
      showToast("Category deleted.");
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  function toggleSelection(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAllCourses() {
    setSelectedCourses((current) => { const next = new Set(current); filteredCourses.forEach((course) => allCoursesSelected ? next.delete(course.id) : next.add(course.id)); return next; });
  }

  function toggleAllCategories() {
    setSelectedCategories(allCategoriesSelected ? new Set() : new Set(categories.map((category) => category.id)));
  }

  async function deleteSelected(resource: "courses" | "categories", selected: Set<string>) {
    if (!selected.size || !window.confirm(`Delete ${selected.size} selected ${resource}? This cannot be undone.`)) return;
    const ids = [...selected];
    try {
      await jsonResponse(await fetch(`/api/admin/resources/${resource}?ids=${encodeURIComponent(ids.join(","))}`, { method: "DELETE" }));
      const deleted = new Set(ids);
      if (resource === "courses") { setCourses((current) => current.filter((item) => !deleted.has(item.id))); setSelectedCourses(new Set()); }
      else { setCategories((current) => current.filter((item) => !deleted.has(item.id))); setSelectedCategories(new Set()); }
      showToast(`${ids.length} ${resource} deleted successfully.`);
    } catch (error) { showToast((error as Error).message, "error"); }
  }

  return <>
    <Topbar title="Courses" subtitle="Build your catalogue, chapters, and video curriculum." action={<button className="primary-action" onClick={() => tab === "courses" ? openCourse() : setCategoryEditor({ ...emptyCategory })}><Icons.plus /> {tab === "courses" ? "New course" : "New category"}</button>} />
    <div className="page-content course-builder-page">
      <div className="workspace-tabs"><button className={tab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>Courses <span>{courses.length}</span></button><button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}>Categories <span>{categories.length}</span></button></div>
      {tab === "courses" ? <section className="panel resource-panel"><div className="resource-toolbar"><label className="small-search"><Icons.search/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search courses" /></label>{selectedCourses.size > 0 && <button className="secondary-action danger-action" onClick={() => deleteSelected("courses", selectedCourses)}>Delete selected ({selectedCourses.size})</button>}<button className="secondary-action" onClick={() => openCourse()}><Icons.plus/> New course</button></div><div className="table-wrap"><table className="resource-table course-builder-table"><thead><tr><th className="selection-cell"><input className="selection-checkbox" type="checkbox" checked={allCoursesSelected} onChange={toggleAllCourses} aria-label="Select all visible courses" /></th><th>Course</th><th>Category</th><th>Curriculum</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredCourses.map((course) => <tr key={course.id} className={selectedCourses.has(course.id) ? "selected-row" : ""}><td className="selection-cell"><input className="selection-checkbox" type="checkbox" checked={selectedCourses.has(course.id)} onChange={() => toggleSelection(setSelectedCourses, course.id)} aria-label={`Select ${course.title}`} /></td><td><span className="course-cell">{course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" /> : <i>{initials(course.title)}</i>}<span><strong>{course.title}</strong><small>{course.featured ? "Featured course" : `${course.students.toLocaleString("en-IN")} students`}</small></span></span></td><td>{categoryName(course, categories)}</td><td><strong>{course.chapters.length} chapters</strong><small className="table-subtext">{course.lessons} assigned videos</small></td><td><strong>{money(course.salePrice || course.price)}</strong></td><td><Status value={course.status}/></td><td><div className="row-actions"><button onClick={() => openCourse(course)}>Edit</button><button className="danger" onClick={() => deleteCourse(course)}>Delete</button></div></td></tr>)}</tbody></table>{!filteredCourses.length && <div className="resource-empty"><strong>No courses found</strong><span>Create your first course or adjust the search.</span></div>}</div></section> : <section className="panel category-panel"><header className="panel-header"><div><h2>Course categories</h2><p>Categories populate the course editor automatically.</p></div><div className="bulk-header-actions"><label className="select-all-control"><input className="selection-checkbox" type="checkbox" checked={allCategoriesSelected} onChange={toggleAllCategories} /> Select all</label>{selectedCategories.size > 0 && <button className="secondary-action danger-action" onClick={() => deleteSelected("categories", selectedCategories)}>Delete selected ({selectedCategories.size})</button>}<button className="primary-action" onClick={() => setCategoryEditor({ ...emptyCategory })}><Icons.plus/> New category</button></div></header><div className="category-list">{categories.map((category) => <article key={category.id} className={selectedCategories.has(category.id) ? "selected-row" : ""}><input className="selection-checkbox" type="checkbox" checked={selectedCategories.has(category.id)} onChange={() => toggleSelection(setSelectedCategories, category.id)} aria-label={`Select ${category.name}`} /><span className="category-icon">{initials(category.name)}</span><div><strong>{category.name}</strong><small>/{category.slug} · {category.description || "No description"}</small></div><span className={`resource-status ${category.active ? "status-published" : "status-archived"}`}>{category.active ? "Active" : "Inactive"}</span><b>{courses.filter((course) => course.categoryId === category.id).length} courses</b><div className="row-actions"><button onClick={() => setCategoryEditor({ ...category })}>Edit</button><button className="danger" onClick={() => deleteCategory(category)}>Delete</button></div></article>)}</div></section>}
    </div>
    {editor && <div className="modal-backdrop"><section className="resource-modal course-modal" role="dialog" aria-modal="true" aria-label="Course editor"><header><div><small>{editor.id ? "Edit course" : "Create course"}</small><h2>{editor.title || "Untitled course"}</h2></div><button onClick={() => setEditor(null)} aria-label="Close">×</button></header><form onSubmit={saveCourse}><div className="course-editor-grid"><div className="course-fields"><label>Course title<input value={editor.title ?? ""} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required /></label><div className="form-grid"><label>Category<select value={editor.categoryId ?? ""} onChange={(event) => setEditor({ ...editor, categoryId: event.target.value })} required><option value="">Select category</option>{activeCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Status<select value={editor.status ?? "Draft"} onChange={(event) => setEditor({ ...editor, status: event.target.value })}><option>Draft</option><option>Published</option><option>Archived</option></select></label><label>Original price (₹)<input type="number" min="0" value={editor.price ?? 0} onChange={(event) => setEditor({ ...editor, price: Number(event.target.value) })} /></label><label>Sale price (₹)<input type="number" min="0" value={editor.salePrice ?? 0} onChange={(event) => setEditor({ ...editor, salePrice: Number(event.target.value) })} /></label></div><label className="resource-checkbox"><input type="checkbox" checked={Boolean(editor.featured)} onChange={(event) => setEditor({ ...editor, featured: event.target.checked })}/><span><strong>Featured course</strong><small>Highlight this course on student-facing pages.</small></span></label></div><div className="thumbnail-uploader"><span>Course thumbnail</span><button type="button" className="thumbnail-preview" onClick={() => fileInput.current?.click()}>{instantPreview || editor.thumbnailUrl ? <img src={instantPreview || editor.thumbnailUrl} alt="Course thumbnail preview" /> : <span><b>＋</b><small>Choose image</small></span>}</button><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => chooseThumbnail(event.target.files?.[0])}/><small>JPG, PNG, WebP, or GIF · Max 10 MB</small>{uploadProgress && <UploadMeter progress={uploadProgress} />}</div></div><section className="attachment-builder"><header><div><h3>Course attachments</h3><p>Add downloadable PDF, ZIP, Word, PowerPoint, or text resources.</p></div><button type="button" className="secondary-action" disabled={attachmentUploading} onClick={() => attachmentInput.current?.click()}><Icons.plus/> {attachmentUploading ? "Uploading…" : "Attach file"}</button><input ref={attachmentInput} hidden type="file" accept=".pdf,.zip,.doc,.docx,.ppt,.pptx,.txt" onChange={(event) => { chooseAttachment(event.target.files?.[0]); event.target.value = ""; }}/></header>{(editor.attachments ?? []).length ? <div className="attachment-list">{(editor.attachments ?? []).map((attachment) => <article key={attachment.id}><span>↧</span><div><strong>{attachment.name}</strong><small>{formatBytes(attachment.sizeBytes)} · {attachment.mimeType}</small></div><button type="button" onClick={() => setEditor({ ...editor, attachments: editor.attachments?.filter((item) => item.id !== attachment.id) })}>Remove</button></article>)}</div> : <div className="chapter-empty">No attachments added to this course.</div>}</section><section className="chapter-builder"><header><div><h3>Course curriculum</h3><p>Create chapters and assign one or more videos from the Video Library.</p></div><button type="button" className="secondary-action" onClick={addChapter}><Icons.plus/> Add chapter</button></header>{!(editor.chapters ?? []).length ? <div className="chapter-empty">No chapters yet. Add Chapter 1 to start building the curriculum.</div> : <div className="chapter-list">{(editor.chapters ?? []).map((chapter, chapterIndex) => <article className="chapter-card" key={chapter.id}><header><span>{String(chapterIndex + 1).padStart(2,"0")}</span><input value={chapter.title} onChange={(event) => updateChapter(chapter.id, { title: event.target.value })} aria-label={`Chapter ${chapterIndex + 1} title`} /><button type="button" onClick={() => setEditor({ ...editor, chapters: editor.chapters?.filter((item) => item.id !== chapter.id) })}>Remove</button></header><div className="chapter-videos">{videos.length ? videos.map((video) => <label key={video.id}><input type="checkbox" checked={chapter.videoIds.includes(video.id)} onChange={() => toggleChapterVideo(chapter, video.id)} /><span><strong>{video.title}</strong><small>{video.provider} · {video.durationMinutes} min · {video.status}</small></span></label>) : <p>No videos yet. Add videos in Video Library, then return to assign them.</p>}</div></article>)}</div>}</section><footer><button type="button" className="secondary-action" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="primary-action" disabled={pending || attachmentUploading || Boolean(uploadProgress && uploadProgress.percent < 100)}>{pending ? "Saving…" : "Save course"}</button></footer></form></section></div>}
    {categoryEditor && <div className="modal-backdrop"><section className="resource-modal category-modal" role="dialog" aria-modal="true" aria-label="Category editor"><header><div><small>{categoryEditor.id ? "Edit" : "Create"}</small><h2>{categoryEditor.id ? "Update category" : "New category"}</h2></div><button onClick={() => setCategoryEditor(null)} aria-label="Close">×</button></header><form onSubmit={saveCategory}><div className="resource-form-grid"><label>Category name<input value={categoryEditor.name ?? ""} onChange={(event) => setCategoryEditor({ ...categoryEditor, name: event.target.value })} required /></label><label>Slug<input value={categoryEditor.slug ?? ""} onChange={(event) => setCategoryEditor({ ...categoryEditor, slug: event.target.value })} placeholder="Auto-generated from name" /></label><label className="wide">Description<textarea rows={4} value={categoryEditor.description ?? ""} onChange={(event) => setCategoryEditor({ ...categoryEditor, description: event.target.value })}/></label><label className="resource-checkbox wide"><input type="checkbox" checked={Boolean(categoryEditor.active)} onChange={(event) => setCategoryEditor({ ...categoryEditor, active: event.target.checked })}/><span><strong>Active category</strong><small>Available when creating and editing courses.</small></span></label></div><footer><button type="button" className="secondary-action" onClick={() => setCategoryEditor(null)}>Cancel</button><button type="submit" className="primary-action" disabled={pending}>{pending ? "Saving…" : "Save category"}</button></footer></form></section></div>}
  </>;
}

function UploadMeter({ progress }: { progress: NonNullable<UploadProgress> }) { return <div className="upload-meter"><div><span style={{ width: `${progress.percent}%` }} /></div><p><strong>{progress.percent}%</strong><span>{formatBytes(progress.loaded)} of {formatBytes(progress.total)}</span></p></div>; }
function Status({ value }: { value: string }) { return <span className={`resource-status status-${value.toLowerCase()}`}>{value}</span>; }
function money(value: number) { return `₹${value.toLocaleString("en-IN")}`; }
function initials(value: string) { return value.split(/\s+/).map((word) => word[0]).join("").slice(0,2).toUpperCase(); }
function categoryName(course: Course, categories: Category[]) { return categories.find((category) => category.id === course.categoryId)?.name ?? course.category ?? "Uncategorized"; }
