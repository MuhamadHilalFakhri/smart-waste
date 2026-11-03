import { randomUUID } from "node:crypto";
import { route, type Context } from "../context.js";
import { transaction } from "../database.js";
import { passwordHash } from "../security.js";
import { HttpError } from "../errors.js";
import { publicUser, type Role, type User } from "../types.js";

export const escapedSearch = (value: string) =>
  `%${value.replace(/[\\%_]/g, "\\$&")}%`;
export function userRoutes(ctx: Context) {
  const { pool } = ctx;
  route(ctx, "GET", "/api/v1/users", "admin", async (req) => {
    const {
      q = "",
      page = 1,
      page_size = 20,
    } = req.query as { q: string; page: number; page_size: number };
    const pattern = escapedSearch(q);
    const where = "WHERE name ILIKE $1 OR email ILIKE $1";
    const total = Number(
      (await pool.query(`SELECT count(*) FROM users ${where}`, [pattern]))
        .rows[0].count,
    );
    const items = (
      await pool.query<User>(
        `SELECT * FROM users ${where} ORDER BY created_at DESC,id LIMIT $2 OFFSET $3`,
        [pattern, page_size, (page - 1) * page_size],
      )
    ).rows.map(publicUser);
    return { items, total, page, page_size };
  });
  route(ctx, "POST", "/api/v1/users", "admin", async (req, reply) => {
    const body = req.body as {
      name: string;
      email: string;
      password: string;
      role: Role;
    };
    if (body.name.trim().length < 2)
      throw new HttpError(422, "Nama minimal 2 karakter");
    const user = (
      await pool.query<User>(
        "INSERT INTO users(id,name,email,password_hash,role,active,created_at) VALUES($1,$2,$3,$4,$5,true,now()) RETURNING *",
        [
          randomUUID(),
          body.name.trim(),
          body.email.toLowerCase(),
          await passwordHash(body.password),
          body.role,
        ],
      )
    ).rows[0];
    return reply.code(201).send(publicUser(user));
  });
  route(ctx, "PATCH", "/api/v1/users/{user_id}", "admin", async (req) => {
    const { user_id } = req.params as { user_id: string };
    const body = req.body as { name: string; role: Role; active: boolean };
    if (body.name.trim().length < 2)
      throw new HttpError(422, "Nama minimal 2 karakter");
    return transaction(pool, async (db) => {
      // Serialize role updates even when no active admin row exists yet.
      await db.query("SELECT pg_advisory_xact_lock(74213002)");
      const admins = (
        await db.query<User>(
          "SELECT * FROM users WHERE role='admin' AND active=true ORDER BY id FOR UPDATE",
        )
      ).rows;
      const user = (
        await db.query<User>("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
          user_id,
        ])
      ).rows[0];
      if (!user) throw new HttpError(404, "Pengguna tidak ditemukan");
      if (
        user.role === "admin" &&
        user.active &&
        (body.role !== "admin" || !body.active) &&
        admins.length <= 1
      )
        throw new HttpError(
          409,
          "Admin aktif terakhir tidak boleh dinonaktifkan atau diturunkan",
        );
      const updated = (
        await db.query<User>(
          "UPDATE users SET name=$1,role=$2,active=$3 WHERE id=$4 RETURNING *",
          [body.name.trim(), body.role, body.active, user_id],
        )
      ).rows[0];
      if (!body.active || user.role !== body.role)
        await db.query(
          "UPDATE refresh_sessions SET revoked=true WHERE user_id=$1",
          [user_id],
        );
      return publicUser(updated);
    });
  });
}
