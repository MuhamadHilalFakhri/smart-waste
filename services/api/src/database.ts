import { Pool, type PoolClient } from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export const createPool = (connectionString: string) =>
  new Pool({ connectionString, max: 10 });
export type Db = Pool | PoolClient;
export async function transaction<T>(
  pool: Pool,
  run: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await run(db);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export async function migrate(pool: Pool) {
  const sql = await readFile(
    new URL("../migrations/001_initial.sql", import.meta.url),
    "utf8",
  );
  const checksum = createHash("sha256").update(sql).digest("hex");
  await transaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(74213001)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const existing = await db.query(
      "SELECT checksum FROM schema_migrations WHERE version=1",
    );
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error("Checksum migrasi berubah; tambahkan migrasi baru");
      return;
    }
    await db.query(sql);
    // Check columns before adopting an existing Alembic database. No data is replaced.
    await db.query(
      "SELECT u.password_hash,s.token_hash,s.csrf_token,r.image_path,r.deleted_at,p.probabilities_json,h.previous_status FROM users u,refresh_sessions s,reports r,predictions p,report_status_history h LIMIT 0",
    );
    await db.query(
      "INSERT INTO schema_migrations(version,checksum) VALUES(1,$1)",
      [checksum],
    );
  });
}
