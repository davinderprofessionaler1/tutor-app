import { randomUUID } from "node:crypto";
import { mkdir, open, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { LiveError } from "./types.js";

export const RECORDING_LIMIT = 100 * 1024 * 1024;
export class RecordingFiles {
  constructor(
    public root = process.env.LIVE_RECORDINGS_DIR ??
      path.resolve(import.meta.dirname, "../../data/live-recordings"),
  ) {}
  file(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new LiveError(404, "Recording not found.");
    return path.join(this.root, `${id}.video`);
  }
  async save(source: AsyncIterable<Buffer>, mime: "video/webm" | "video/mp4") {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const id = randomUUID(),
      name = this.file(id),
      file = await open(name, "wx", 0o600);
    let bytes = 0;
    let prefix = Buffer.alloc(0);
    try {
      for await (const part of source) {
        const chunk = Buffer.from(part);
        bytes += chunk.length;
        if (bytes > RECORDING_LIMIT)
          throw new LiveError(413, "Recordings must be under 100 MB.");
        if (prefix.length < 12)
          prefix = Buffer.concat([
            prefix,
            chunk.subarray(0, 12 - prefix.length),
          ]);
        await file.writeFile(chunk);
      }
      const valid =
        mime === "video/webm"
          ? prefix.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
          : prefix.subarray(4, 8).toString() === "ftyp";
      if (!valid)
        throw new LiveError(400, "Upload a valid WebM or MP4 recording.");
      return { id, mime, bytes, createdAt: new Date().toISOString() };
    } catch (error) {
      await unlink(name).catch(() => undefined);
      throw error;
    } finally {
      await file.close();
    }
  }
  read(id: string) {
    return createReadStream(this.file(id));
  }
  async discard(id: string) {
    await unlink(this.file(id)).catch(() => undefined);
  }
}
