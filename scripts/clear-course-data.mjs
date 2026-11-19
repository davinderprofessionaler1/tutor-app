import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const storePath = path.join(root, "apps", "admin", "data", "admin-store.json");
const backupDirectory = path.join(root, ".tmp");
const timestamp = new Date().toISOString().replaceAll(":", "-");
const backupPath = path.join(
  backupDirectory,
  `admin-store-before-course-clear-${timestamp}.json`,
);

const store = JSON.parse(await readFile(storePath, "utf8"));

if (!Array.isArray(store.courses) || !Array.isArray(store.videos)) {
  throw new Error("The admin store does not contain valid course arrays.");
}

const summary = {
  courses: store.courses.length,
  videos: store.videos.length,
  assignments: Array.isArray(store.students)
    ? store.students.reduce(
        (total, student) =>
          total + (Array.isArray(student.courseIds) ? student.courseIds.length : 0),
        0,
      )
    : 0,
};

await mkdir(backupDirectory, { recursive: true });
await copyFile(storePath, backupPath);

store.courses = [];
store.videos = [];
if (Array.isArray(store.students)) {
  for (const student of store.students) student.courseIds = [];
}
store.updatedAt = new Date().toISOString();

await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

console.log(
  `Cleared ${summary.courses} courses, ${summary.videos} videos, and ${summary.assignments} student assignments.`,
);
console.log(`Backup: ${backupPath}`);
