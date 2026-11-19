import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  emptyLiveState,
  type LiveRepository,
  type LiveState,
  type Platform,
} from "./types.js";

const platformPath = path.resolve(
  import.meta.dirname,
  "../../../admin/data/admin-store.json",
);
export async function readPlatform(): Promise<Platform> {
  return JSON.parse(await readFile(platformPath, "utf8"));
}

// Only the API process owns this development file. Production requires PostgreSQL.
export class FileLiveRepository implements LiveRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private file = path.resolve(
      import.meta.dirname,
      "../../data/live-classrooms.json",
    ),
  ) {}
  transaction<T>(work: (state: LiveState) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      let state = emptyLiveState();
      try {
        state = { ...state, ...JSON.parse(await readFile(this.file, "utf8")) };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const before = JSON.stringify(state);
      const result = await work(state);
      const after = JSON.stringify(state);
      if (after !== before) {
        await mkdir(path.dirname(this.file), { recursive: true });
        const temporary = `${this.file}.${randomUUID()}.tmp`;
        await writeFile(temporary, after, { mode: 0o600 });
        await rename(temporary, this.file);
      }
      return structuredClone(result);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

export const liveTables = {
  classes: "live_classes",
  orders: "live_payment_orders",
  enrollments: "live_class_enrollments",
  tickets: "live_join_tickets",
  attendance: "live_attendance",
  messages: "live_chat_messages",
  events: "live_session_events",
  notifications: "live_notifications",
  webhooks: "live_webhook_receipts",
} as const;

// A short database-wide advisory transaction lock keeps capacity, payments and
// webhook replay decisions atomic across API replicas. Only changed rows are upserted.
export class PostgresLiveRepository implements LiveRepository {
  private pool: pg.Pool;
  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  }
  async transaction<T>(work: (state: LiveState) => T | Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '10s'");
      await client.query("SELECT pg_advisory_xact_lock(719248102)");
      const state = emptyLiveState();
      const originals = new Map<string, string>();
      for (const [key, table] of Object.entries(liveTables)) {
        const rows = await client.query(`SELECT payload FROM ${table}`);
        (state[key as keyof LiveState] as unknown[]) = rows.rows.map(
          (row) => row.payload,
        );
        for (const row of rows.rows)
          originals.set(
            `${key}:${row.payload.id}`,
            JSON.stringify(row.payload),
          );
      }
      const result = await work(state);
      for (const [key, table] of Object.entries(liveTables)) {
        for (const record of state[key as keyof LiveState]) {
          const value = JSON.stringify(record);
          if (value !== originals.get(`${key}:${record.id}`))
            await client.query(
              `INSERT INTO ${table} (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
              [record.id, value],
            );
        }
      }
      await client.query("COMMIT");
      return structuredClone(result);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
}

let repository: LiveRepository | undefined;
export function liveRepository() {
  if (!repository) {
    if (process.env.LIVE_DATABASE_URL)
      repository = new PostgresLiveRepository(process.env.LIVE_DATABASE_URL);
    else if (process.env.NODE_ENV === "production")
      throw new Error(
        "LIVE_DATABASE_URL is required for Live Classes in production.",
      );
    else repository = new FileLiveRepository();
  }
  return repository;
}
export async function purchasedLiveCourseIds(studentId: string) {
  // The optional module must not interrupt existing authentication when disabled.
  if (!process.env.LIVE_DATABASE_URL && process.env.NODE_ENV === "production")
    return [];
  return liveRepository().transaction((state) => [
    ...new Set(
      state.orders
        .filter(
          (order) =>
            order.studentId === studentId &&
            order.kind === "course" &&
            order.status === "Paid",
        )
        .map((order) => order.targetId),
    ),
  ]);
}
