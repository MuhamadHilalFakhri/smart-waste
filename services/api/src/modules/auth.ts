import { randomUUID } from "node:crypto";
import { transaction } from "../database.js";
import type { Context } from "../context.js";
import { route } from "../context.js";
import { HttpError } from "../errors.js";
import { mobile, passwordHash } from "../security.js";
import type { User } from "../types.js";
import { publicUser } from "../types.js";

export function authRoutes(ctx: Context) {
  const { pool, security } = ctx;
  for (const kind of ["register", "login"] as const) {
    route(ctx, "POST", `/api/v1/auth/${kind}`, "public", async (req, reply) => {
      security.checkOrigin(req);
      security.limit(req);
      const body = req.body as {
        name?: string;
        email: string;
        password: string;
      };
      const email = body.email.toLowerCase();
      let user: User;
      if (kind === "register") {
        const name = body.name!.trim();
        if (name.length < 2)
          throw new HttpError(422, "Nama minimal 2 karakter");
        user = (
          await pool.query<User>(
            "INSERT INTO users(id,name,email,password_hash,role,active,created_at) VALUES($1,$2,$3,$4,'user',true,now()) RETURNING *",
            [randomUUID(), name, email, await passwordHash(body.password)],
          )
        ).rows[0];
        reply.code(201);
      } else {
        const found = (
          await pool.query<User>("SELECT * FROM users WHERE email=$1", [email])
        ).rows[0];
        const valid = await security.loginPassword(found, body.password);
        if (!found?.active || !valid)
          throw new HttpError(401, "Email atau password tidak sesuai");
        user = found;
      }
      const { session, refresh } = await security.newSession(pool, user);
      return security.issue(reply, user, session, refresh, mobile(req));
    });
  }
  for (const kind of ["refresh", "logout"] as const) {
    route(ctx, "POST", `/api/v1/auth/${kind}`, "public", async (req, reply) => {
      const isMobile = mobile(req);
      const token = isMobile
        ? (req.body as { refresh_token?: string }).refresh_token
        : req.cookies.sw_refresh;
      if (kind === "logout" && !token) {
        security.clearCookies(reply);
        return reply.code(204).send();
      }
      const result = await transaction(pool, async (db) => {
        const { session, replay } = await security.refreshSession(db, token);
        if (!isMobile) security.csrf(req, session);
        if (replay) {
          await db.query(
            "UPDATE refresh_sessions SET revoked=true WHERE id=$1",
            [session.id],
          );
          return null; // Commit revocation before returning the replay error.
        }
        if (kind === "logout") {
          await db.query(
            "UPDATE refresh_sessions SET revoked=true WHERE id=$1",
            [session.id],
          );
          return { logout: true } as const;
        }
        const user = (
          await db.query<User>("SELECT * FROM users WHERE id=$1", [
            session.user_id,
          ])
        ).rows[0];
        if (!user?.active) throw new HttpError(401, "Akun tidak aktif");
        return { user, session, refresh: await security.rotate(db, session) };
      });
      if (!result)
        throw new HttpError(
          401,
          "Token sesi telah digunakan. Silakan masuk kembali.",
        );
      if ("logout" in result) {
        security.clearCookies(reply);
        return reply.code(204).send();
      }
      return security.issue(
        reply,
        result.user,
        result.session,
        result.refresh,
        isMobile,
      );
    });
  }
  route(ctx, "GET", "/api/v1/auth/me", "user", async (req) =>
    publicUser(req.user),
  );
}
