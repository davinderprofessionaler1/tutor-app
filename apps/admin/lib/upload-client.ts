"use client";

export type UploadedFile = { url: string; fileName: string; size: number; contentType: string };

export function uploadFile(file: File, kind: "thumbnail" | "video" | "logo" | "attachment", onProgress: (percent: number, loaded: number, total: number) => void) {
  return new Promise<UploadedFile>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `/api/admin/upload?kind=${kind}&filename=${encodeURIComponent(file.name)}`);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      const total = event.total || file.size;
      onProgress(Math.min(100, Math.round((event.loaded / total) * 100)), event.loaded, total);
    };
    request.onerror = () => reject(new Error("Network error while uploading the file."));
    request.onload = () => {
      const result = JSON.parse(request.responseText || "{}") as UploadedFile & { error?: string };
      if (request.status === 401) window.location.assign("/login");
      if (request.status < 200 || request.status >= 300) reject(new Error(result.error ?? "Upload failed."));
      else { onProgress(100, file.size, file.size); resolve(result); }
    };
    request.send(file);
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
