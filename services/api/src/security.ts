import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "./config.js";
import type { Db } from "./database.js";
import type { Pool } from "pg";
import type { Session, User } from "./types.js";
import { publicUser } from "./types.js";
import { HttpError } from "./errors.js";

export const passwordHash = (value: string) =>
  hash(value, { memoryCost: 65536, timeCost: 3, parallelism: 4 });
export const passwordMatches = (encoded: string, value: string) =>
  verify(encoded, value).catch(() => false);
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const constantEqual = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export const newRefresh = (id: string) =>
  `${id}.${randomBytes(48).toString("base64url")}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const mobile = (request: FastifyRequest) =>
  request.headers["x-client-type"] === "mobile";

export class Security {
  private attempts = new Map<string, number[]>();
  private secret: Uint8Array;
  private dummyHash: Promise<string>;
  constructor(
    private config: Config,
    private pool: Pool,
  ) {
    this.secret = new TextEncoder().encode(config.jwtSecret);
    this.dummyHash = passwordHash("timing-comparison-only-password");
  }
  async loginPassword(user: User | undefined, value: string) {
    return passwordMatches(
      user?.password_hash || (await this.dummyHash),
      value,
    );
  }
  checkOrigin(request: FastifyRequest) {
    const origin = request.headers.origin;
    if (origin && !this.config.allowedOrigins.includes(origin))
      throw new HttpError(403, "Asal permintaan tidak diizinkan");
  }
  limit(request: FastifyRequest) {
    const now = Date.now(),
      cutoff = now - 900000;
    if (this.attempts.size > 10000) {
      for (const [key, values] of this.attempts)
        if (!values.length || values.at(-1)! < cutoff)
          this.attempts.delete(key);
      if (this.attempts.size > 10000)
        throw new HttpError(429, "Terlalu banyak permintaan. Coba lagi nanti.");
    }
    const queue = (this.attempts.get(request.ip) || []).filter(
      (v) => v >= cutoff,
    );
    if (queue.length >= 10)
      throw new HttpError(429, "Terlalu banyak percobaan. Tunggu 15 menit.");
    queue.push(now);
    this.attempts.set(request.ip, queue);
  }
  csrf(request: FastifyRequest, session: Session) {
    this.checkOrigin(request);
    const token = request.headers["x-csrf-token"];
    if (typeof token !== "string" || !constantEqual(token, session.csrf_token))
      throw new HttpError(403, "Token CSRF tidak valid. Muat ulang halaman.");
  }
  async authenticate(request: FastifyRequest, admin = false) {
    const auth = request.headers.authorization;
    const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = bearer || request.cookies.sw_access || "";
    let sub: string, sid: string;
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: "smart-waste",
        audience: "smart-waste-clients",
        requiredClaims: ["sub", "sid", "exp", "iat"],
      });
      sub = String(payload.sub);
      sid = String(payload.sid);
      if (!uuid.test(sub) || !uuid.test(sid))
        throw new Error("Invalid subject");
    } catch {
      throw new HttpError(401, "Sesi berakhir. Silakan masuk kembali.");
    }
    const user = (
      await this.pool.query<User>("SELECT * FROM users WHERE id=$1", [sub])
    ).rows[0];
    const session = (
      await this.pool.query<Session>(
        "SELECT * FROM refresh_sessions WHERE id=$1",
        [sid],
      )
    ).rows[0];
    if (
      !user?.active ||
      !session ||
      session.revoked ||
      session.user_id !== user.id ||
      session.expires_at.getTime() <= Date.now()
    )
      throw new HttpError(401, "Sesi tidak aktif. Silakan masuk kembali.");
    if (!bearer && !["GET", "HEAD", "OPTIONS"].includes(request.method))
      this.csrf(request, session);
    if (admin && user.role !== "admin")
      throw new HttpError(403, "Akses khusus Admin");
    request.user = user;
    request.session = session;
  }
  async newSession(db: Db, user: User) {
    const id = randomUUID(),
      refresh = newRefresh(id);
    const session = (
      await db.query<Session>(
        `INSERT INTO refresh_sessions(id,user_id,token_hash,csrf_token,expires_at,revoked)
      VALUES($1,$2,$3,$4,$5,false) RETURNING *`,
        [
          id,
          user.id,
          digest(refresh),
          randomBytes(32).toString("hex"),
          new Date(Date.now() + this.config.refreshDays * 86400000),
        ],
      )
    ).rows[0];
    return { session, refresh };
  }
  async refreshSession(db: Db, token: unknown) {
    if (typeof token !== "string" || !uuid.test(token.split(".")[0]))
      throw new HttpError(401, "Sesi berakhir. Silakan masuk kembali.");
    const session = (
      await db.query<Session>(
        "SELECT * FROM refresh_sessions WHERE id=$1 FOR UPDATE",
        [token.split(".")[0]],
      )
    ).rows[0];
    if (
      !session ||
      session.revoked ||
      session.expires_at.getTime() <= Date.now()
    )
      throw new HttpError(401, "Sesi berakhir. Silakan masuk kembali.");
    return {
      session,
      replay: !constantEqual(session.token_hash, digest(token)),
    };
  }
  async rotate(db: Db, session: Session) {
    const token = newRefresh(session.id);
    await db.query("UPDATE refresh_sessions SET token_hash=$1 WHERE id=$2", [
      digest(token),
      session.id,
    ]);
    return token;
  }
  async issue(
    reply: FastifyReply,
    user: User,
    session: Session,
    refresh: string,
    isMobile: boolean,
  ) {
    const access = await new SignJWT({ sid: session.id })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuer("smart-waste")
      .setAudience("smart-waste-clients")
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessMinutes}m`)
      .sign(this.secret);
    if (!isMobile) {
      const options = {
        path: "/",
        secure: this.config.cookieSecure,
        sameSite: "lax" as const,
      };
      reply.setCookie("sw_access", access, {
        ...options,
        httpOnly: true,
        maxAge: this.config.accessMinutes * 60,
      });
      reply.setCookie("sw_refresh", refresh, {
        ...options,
        httpOnly: true,
        maxAge: Math.floor((session.expires_at.getTime() - Date.now()) / 1000),
      });
      reply.setCookie("sw_csrf", session.csrf_token, {
        ...options,
        httpOnly: false,
        maxAge: this.config.refreshDays * 86400,
      });
    }
    return {
      user: publicUser(user),
      access_token: isMobile ? access : null,
      refresh_token: isMobile ? refresh : null,
      token_type: "bearer",
    };
  }
  clearCookies(reply: FastifyReply) {
    for (const name of ["sw_access", "sw_refresh", "sw_csrf"])
      reply.clearCookie(name, {
        path: "/",
        secure: this.config.cookieSecure,
        sameSite: "lax",
      });
  }
}
