import Fastify, { LogController } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { Pool } from "pg";
import type { Config } from "./config.js";
import { createPool } from "./database.js";
import { contract } from "./contract.js";
import { Security } from "./security.js";
import { MlClient, type MlService } from "./ml.js";
import { MAX_UPLOAD } from "./media.js";
import { authRoutes } from "./modules/auth.js";
import { userRoutes } from "./modules/users.js";
import { reportRoutes } from "./modules/reports.js";
import { dashboardRoutes } from "./modules/dashboard.js";
import { predictionRoutes } from "./modules/predictions.js";
import { HttpError } from "./errors.js";

export async function buildApp(
  config: Config,
  overrides: { pool?: Pool; ml?: MlService; logger?: boolean } = {},
) {
  const pool = overrides.pool || createPool(config.databaseUrl);
  const ml = overrides.ml || new MlClient(config);
  const app = Fastify({
    logger: overrides.logger ?? true,
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: config.trustProxy ? (_address, hop) => hop < 1 : false,
    bodyLimit: 11 * 1024 * 1024,
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-CSRF-Token",
      "X-Client-Type",
    ],
  });
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD,
      files: 1,
      fields: 8,
      fieldSize: 10000,
      parts: 9,
    },
  });
  const jsonParser = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      if (!String(body).trim()) return done(null, {});
      jsonParser(req, String(body), (error, value) =>
        done(error ? new HttpError(400, "JSON tidak valid") : null, value),
      );
    },
  );
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(String(body))));
    },
  );
  await app.register(swagger, {
    mode: "static",
    specification: { document: contract },
  });
  await app.register(swaggerUi, { routePrefix: "/api/docs" });
  app.get("/api/openapi.json", async () => contract);
  app.addHook("onSend", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "strict-origin-when-cross-origin");
    if (req.url.startsWith("/api/v1"))
      reply.header("Cache-Control", "no-store");
  });
  app.setErrorHandler((error, req, reply) => {
    const e = error as Error & { code?: string; statusCode?: number };
    if (e.code === "23505")
      return reply.code(409).send({ detail: "Email sudah digunakan" });
    if (
      e.code?.startsWith("FST_REQ_FILE_TOO_LARGE") ||
      e.code === "FST_ERR_CTP_BODY_TOO_LARGE"
    )
      return reply.code(413).send({ detail: "Foto maksimal 10 MB" });
    if (e.code?.startsWith("FST_") && !e.statusCode)
      return reply.code(422).send({ detail: "Periksa data yang diisi" });
    const status = e.statusCode || 500;
    if (status >= 500)
      app.log.error(
        {
          method: req.method,
          path: req.routeOptions.url,
          code: e.code || "INTERNAL",
        },
        "Permintaan gagal",
      );
    return reply.code(status).send({
      detail:
        status >= 500
          ? "Terjadi kesalahan server. Silakan coba lagi."
          : e.message,
    });
  });
  const security = new Security(config, pool);
  const ctx = { app, pool, ml, config, security };
  authRoutes(ctx);
  userRoutes(ctx);
  reportRoutes(ctx);
  dashboardRoutes(ctx);
  predictionRoutes(ctx);
  app.get("/api/health", async () => ({
    status: "ok",
    model_loaded: await ml.health(),
    backend: "nodejs",
  }));
  app.get("/api/ready", async (_req, reply) => {
    try {
      await pool.query("SELECT 1");
      return {
        status: "ready",
        model_loaded: await ml.health(),
        backend: "nodejs",
      };
    } catch {
      return reply.code(503).send({
        status: "unavailable",
        model_loaded: false,
        backend: "nodejs",
      });
    }
  });
  if (!overrides.pool)
    app.addHook("onClose", async () => {
      await pool.end();
    });
  return app;
}
