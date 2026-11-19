import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";
const url = process.env.LIVE_DATABASE_URL;
if (!url)
  throw new Error(
    "Set LIVE_DATABASE_URL explicitly. This migration only creates the Live Classroom tables.",
  );
const pool = new pg.Pool({ connectionString: url });
try {
  await pool.query(
    await readFile(
      new URL("../migrations/live/001_live_classrooms.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "Additive Live Classroom migration applied. Existing platform tables were not changed.",
  );
} finally {
  await pool.end();
}
