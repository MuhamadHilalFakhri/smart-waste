import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { Config } from "./config.js";
import { transaction } from "./database.js";
import { passwordHash } from "./security.js";

export async function seedAdmin(pool: Pool, config: Config) {
  if (config.adminPassword.length < 12)
    throw new Error("ADMIN_PASSWORD minimal 12 karakter");
  await transaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(74213002)");
    const existing = (
      await db.query("SELECT role,active FROM users WHERE email=$1", [
        config.adminEmail,
      ])
    ).rows[0];
    if (existing) {
      if (existing.role !== "admin" || !existing.active)
        throw new Error("Email seed sudah dimiliki akun non-Admin/nonaktif");
      return;
    }
    await db.query(
      "INSERT INTO users(id,name,email,password_hash,role,active,created_at) VALUES($1,'Administrator',$2,$3,'admin',true,now())",
      [
        randomUUID(),
        config.adminEmail,
        await passwordHash(config.adminPassword),
      ],
    );
  });
}
