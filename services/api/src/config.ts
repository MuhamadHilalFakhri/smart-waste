import { resolve } from "node:path";

export function config(env = process.env) {
  const jwtSecret = env.JWT_SECRET || "";
  if (jwtSecret.length < 32) throw new Error("JWT_SECRET minimal 32 karakter");
  const mlToken = env.ML_SERVICE_TOKEN || "";
  if (mlToken.length < 32)
    throw new Error("ML_SERVICE_TOKEN minimal 32 karakter");
  const origins: unknown = JSON.parse(
    env.ALLOWED_ORIGINS || '["http://localhost:3000"]',
  );
  if (!Array.isArray(origins) || !origins.every((x) => typeof x === "string"))
    throw new Error("ALLOWED_ORIGINS harus array origin");
  const databaseUrl = env.DATABASE_URL || "";
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl))
    throw new Error("DATABASE_URL harus PostgreSQL");
  return {
    databaseUrl,
    jwtSecret,
    mlToken,
    mlUrl: (env.ML_SERVICE_URL || "http://127.0.0.1:8001").replace(/\/$/, ""),
    allowedOrigins: origins as string[],
    cookieSecure: env.COOKIE_SECURE === "true",
    storageDir: resolve(env.STORAGE_DIR || "storage"),
    accessMinutes: 15,
    refreshDays: 7,
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 8000),
    trustProxy: env.TRUST_PROXY === "true",
    adminEmail: (env.ADMIN_EMAIL || "admin@example.com").toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || "",
  };
}
export type Config = ReturnType<typeof config>;
