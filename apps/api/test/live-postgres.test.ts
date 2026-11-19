import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("additive migration is idempotent and enforces PostgreSQL generated keys, foreign keys and unique enrollment", async () => {
  const database = new PGlite();
  try {
    await database.exec(
      "CREATE TABLE existing_platform_data(id text PRIMARY KEY); INSERT INTO existing_platform_data VALUES ('preserved');",
    );
    const migration = await readFile(
      new URL("../migrations/live/001_live_classrooms.sql", import.meta.url),
      "utf8",
    );
    await database.exec(migration);
    await database.exec(migration);
    assert.equal(
      (
        await database.query<{ id: string }>(
          "SELECT id FROM existing_platform_data",
        )
      ).rows[0]?.id,
      "preserved",
    );
    const value = {
      id: "class",
      teacherId: "teacher",
      courseId: "existing-course",
      status: "Scheduled",
      startsAt: new Date().toISOString(),
      capacity: 25,
      price: 29900,
    };
    await database.query(
      "INSERT INTO live_classes (id,payload) VALUES ($1,$2)",
      [value.id, JSON.stringify(value)],
    );
    assert.equal(
      (
        await database.query<{ teacher_id: string }>(
          "SELECT teacher_id FROM live_classes",
        )
      ).rows[0]?.teacher_id,
      "teacher",
    );
    const enrollment = {
      id: "enrollment1",
      classId: "class",
      studentId: "existing-student",
      orderId: null,
      status: "Active",
    };
    await database.query(
      "INSERT INTO live_class_enrollments (id,payload) VALUES ($1,$2)",
      [enrollment.id, JSON.stringify(enrollment)],
    );
    await assert.rejects(
      database.query(
        "INSERT INTO live_class_enrollments (id,payload) VALUES ($1,$2)",
        ["enrollment2", JSON.stringify({ ...enrollment, id: "enrollment2" })],
      ),
    );
    await assert.rejects(
      database.query(
        "INSERT INTO live_class_enrollments (id,payload) VALUES ($1,$2)",
        [
          "orphan",
          JSON.stringify({
            ...enrollment,
            id: "orphan",
            classId: "missing",
            studentId: "another-student",
          }),
        ],
      ),
    );
    await assert.rejects(
      database.query("DELETE FROM live_classes WHERE id = 'class'"),
    );
  } finally {
    await database.close();
  }
});
