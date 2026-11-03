import { after, afterEach, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { FastifyInstance, InjectOptions } from "fastify";
import { buildApp } from "../src/app.js";
import { config } from "../src/config.js";
import { createPool, migrate } from "../src/database.js";
import { seedAdmin } from "../src/seed.js";
import { unavailable } from "../src/ml.js";
import type { Prediction } from "../src/types.js";
import { contract } from "../src/contract.js";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/\b[a-z0-9_]*test[a-z0-9_]*$/i.test(new URL(url).pathname))
  throw new Error(
    "TEST_DATABASE_URL wajib memakai database khusus dengan nama mengandung test",
  );
const pool = createPool(url);
const settings = config({
  DATABASE_URL: url,
  JWT_SECRET: "integration-jwt-secret-at-least-32-characters",
  ML_SERVICE_TOKEN: "integration-ml-token-at-least-32-characters",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "AdminPassword123",
});
let app: FastifyInstance, directory: string, raw: Buffer;
let prediction: Prediction;
const request = (
  method: InjectOptions["method"],
  url: string,
  body?: object,
  headers: Record<string, string> = {},
) =>
  app.inject({
    method,
    url,
    headers: { "content-type": "application/json", ...headers },
    ...(body ? { payload: body } : {}),
  });
const bearer = (session: any) => ({
  authorization: `Bearer ${session.access_token}`,
});
async function auth(email = "user@example.com") {
  const result = await request(
    "POST",
    "/api/v1/auth/register",
    { name: "Pelapor", email, password: "StrongPassword123", role: "admin" },
    { "x-client-type": "mobile" },
  );
  assert.equal(result.statusCode, 201, result.body);
  return result.json();
}
async function admin() {
  const result = await request(
    "POST",
    "/api/v1/auth/login",
    { email: "admin@example.com", password: "AdminPassword123" },
    { "x-client-type": "mobile" },
  );
  assert.equal(result.statusCode, 200, result.body);
  return bearer(result.json());
}
async function report(
  headers: Record<string, string>,
  values: Record<string, string> = {},
  path = "/api/v1/reports",
  method: "POST" | "PATCH" = "POST",
  file = raw,
) {
  const boundary = "smart-waste-test-boundary";
  const fields = {
    description: "Sampah di dekat taman kota",
    category: "organic",
    latitude: "-6.2",
    longitude: "106.8",
    accuracy: "12",
    ...values,
  };
  const parts = Object.entries(fields).map(([key, value]) =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
    ),
  );
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="sample.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return app.inject({
    method,
    url: path,
    headers: {
      ...headers,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat(parts),
  });
}
before(async () => {
  await migrate(pool);
  raw = await sharp({
    create: { width: 64, height: 48, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
});
beforeEach(async () => {
  await pool.query(
    "TRUNCATE users,reports,refresh_sessions,predictions,report_status_history CASCADE",
  );
  directory = await mkdtemp(join(tmpdir(), "smart-waste-api-test-"));
  prediction = unavailable();
  await seedAdmin(pool, settings);
  app = await buildApp(
    { ...settings, storageDir: directory },
    {
      pool,
      logger: false,
      ml: {
        health: async () => prediction.outcome === "predicted",
        predict: async () => prediction,
      },
    },
  );
});
afterEach(async () => {
  await app.close();
  await rm(directory, { recursive: true, force: true });
});
after(async () => {
  await pool.end();
});

test("registrasi selalu User, duplikasi dan password pendek ditolak", async () => {
  const session = await auth();
  assert.equal(session.user.role, "user");
  assert.equal(session.user.password_hash, undefined);
  assert.equal(
    (
      await request("POST", "/api/v1/auth/register", {
        name: "Someone",
        email: "user@example.com",
        password: "StrongPassword123",
      })
    ).statusCode,
    409,
  );
  const bad = await request("POST", "/api/v1/auth/register", {
    name: "Someone",
    email: "other@example.com",
    password: "short",
  });
  assert.equal(bad.statusCode, 422);
  assert.equal(bad.body.includes("short"), false);
});
test("rotasi refresh dan replay mencabut sesi", async () => {
  const session = await auth();
  const rotated = await request(
    "POST",
    "/api/v1/auth/refresh",
    { refresh_token: session.refresh_token },
    { "x-client-type": "mobile" },
  );
  assert.equal(rotated.statusCode, 200, rotated.body);
  assert.notEqual(rotated.json().refresh_token, session.refresh_token);
  const replay = await request(
    "POST",
    "/api/v1/auth/refresh",
    { refresh_token: session.refresh_token },
    { "x-client-type": "mobile" },
  );
  assert.equal(replay.statusCode, 401);
  assert.equal(
    (await request("GET", "/api/v1/auth/me", undefined, bearer(rotated.json())))
      .statusCode,
    401,
  );
});
test("logout mencabut akses", async () => {
  const session = await auth();
  assert.equal(
    (
      await request(
        "POST",
        "/api/v1/auth/logout",
        { refresh_token: session.refresh_token },
        { "x-client-type": "mobile" },
      )
    ).statusCode,
    204,
  );
  assert.equal(
    (await request("GET", "/api/v1/auth/me", undefined, bearer(session)))
      .statusCode,
    401,
  );
});
test("cookie HttpOnly, CSRF terikat sesi, dan Origin diperiksa", async () => {
  const login = await request("POST", "/api/v1/auth/login", {
    email: "admin@example.com",
    password: "AdminPassword123",
  });
  assert.equal(login.json().access_token, null);
  const cookies = login.cookies;
  assert.equal(cookies.find((c) => c.name === "sw_access")?.httpOnly, true);
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  assert.equal(
    (await request("POST", "/api/v1/auth/refresh", {}, { cookie })).statusCode,
    403,
  );
  const csrf = cookies.find((c) => c.name === "sw_csrf")!.value;
  assert.equal(
    (
      await request(
        "POST",
        "/api/v1/auth/refresh",
        {},
        { cookie, "x-csrf-token": csrf, origin: "https://evil.example" },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await request(
        "POST",
        "/api/v1/auth/refresh",
        {},
        { cookie, "x-csrf-token": csrf },
      )
    ).statusCode,
    200,
  );
});
test("kepemilikan laporan/foto, filter, pagination, dan statistik", async () => {
  const owner = bearer(await auth()),
    adminHeaders = await admin();
  const created = await report(owner);
  assert.equal(created.statusCode, 201, created.body);
  const data = created.json();
  assert.equal(data.predictions[0].outcome, "unavailable");
  const other = bearer(await auth("other@example.com"));
  for (const suffix of ["", "/photo"]) {
    assert.equal(
      (
        await request(
          "GET",
          `/api/v1/reports/${data.id}${suffix}`,
          undefined,
          other,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/v1/reports/${data.id}${suffix}`,
          undefined,
          adminHeaders,
        )
      ).statusCode,
      200,
    );
  }
  assert.equal(
    (await request("GET", "/api/v1/dashboard", undefined, other)).json().total,
    0,
  );
  assert.equal(
    (await request("GET", "/api/v1/dashboard", undefined, adminHeaders)).json()
      .total,
    1,
  );
  for (const query of ["q=taman&category=organic", `q=${data.id}`])
    assert.equal(
      (
        await request("GET", `/api/v1/reports?${query}`, undefined, owner)
      ).json().total,
      1,
    );
  assert.equal(
    (
      await request(
        "GET",
        "/api/v1/reports?page=2&page_size=1",
        undefined,
        owner,
      )
    ).json().items.length,
    0,
  );
});
test("edit foto diaudit, workflow dan status final dibatasi", async () => {
  const owner = bearer(await auth()),
    adminHeaders = await admin();
  const created = (await report(owner)).json();
  const path = `/api/v1/reports/${created.id}`;
  const edited = await report(owner, { category: "paper" }, path, "PATCH");
  assert.equal(edited.statusCode, 200, edited.body);
  assert.equal(edited.json().predictions.length, 2);
  assert.equal(
    (await request("PATCH", path + "/status", { status: "in_progress" }, owner))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await request(
        "PATCH",
        path + "/status",
        { status: "completed" },
        adminHeaders,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await request(
        "PATCH",
        path + "/status",
        { status: "in_progress" },
        adminHeaders,
      )
    ).statusCode,
    200,
  );
  assert.equal((await report(owner, {}, path, "PATCH")).statusCode, 409);
  assert.equal(
    (await request("DELETE", path, undefined, owner)).statusCode,
    409,
  );
  assert.equal(
    (
      await request(
        "PATCH",
        path + "/status",
        { status: "completed" },
        adminHeaders,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await request(
        "PATCH",
        path + "/status",
        { status: "pending" },
        adminHeaders,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (await request("DELETE", path, undefined, adminHeaders)).statusCode,
    204,
  );
  assert.equal((await request("GET", path, undefined, owner)).statusCode, 404);
});
test("Rejected memerlukan alasan dan riwayat", async () => {
  const owner = bearer(await auth()),
    adminHeaders = await admin();
  const data = (await report(owner)).json();
  const path = `/api/v1/reports/${data.id}/status`;
  assert.equal(
    (
      await request(
        "PATCH",
        path,
        { status: "rejected", note: " " },
        adminHeaders,
      )
    ).statusCode,
    422,
  );
  const result = await request(
    "PATCH",
    path,
    { status: "rejected", note: "Lokasi tidak dapat diverifikasi" },
    adminHeaders,
  );
  assert.equal(result.statusCode, 200);
  assert.equal(
    result.json().history.at(-1).note,
    "Lokasi tidak dapat diverifikasi",
  );
});
test("Admin terakhir dilindungi dan akun nonaktif kehilangan akses", async () => {
  const session = await auth(),
    adminHeaders = await admin();
  const current = (
    await request("GET", "/api/v1/auth/me", undefined, adminHeaders)
  ).json();
  assert.equal(
    (
      await request(
        "PATCH",
        `/api/v1/users/${current.id}`,
        { name: "Admin", role: "user", active: true },
        adminHeaders,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (await request("GET", "/api/v1/users", undefined, bearer(session)))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await request(
        "PATCH",
        `/api/v1/users/${session.user.id}`,
        { name: "Disabled", role: "user", active: false },
        adminHeaders,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (await request("GET", "/api/v1/auth/me", undefined, bearer(session)))
      .statusCode,
    401,
  );
  assert.equal(
    (
      await request("POST", "/api/v1/auth/login", {
        email: "user@example.com",
        password: "StrongPassword123",
      })
    ).statusCode,
    401,
  );
});
for (const [field, value] of [
  ["latitude", "91"],
  ["longitude", "181"],
  ["accuracy", "-1"],
  ["category", "metal"],
  ["description", "          "],
]) {
  test(`validasi laporan: ${field}`, async () =>
    assert.equal(
      (await report(bearer(await auth()), { [field]: value })).statusCode,
      422,
    ));
}
test("foto rusak dan terlalu besar ditolak", async () => {
  const headers = bearer(await auth());
  assert.equal(
    (await report(headers, {}, undefined, undefined, Buffer.from("invalid")))
      .statusCode,
    422,
  );
  assert.equal(
    (
      await report(
        headers,
        {},
        undefined,
        undefined,
        Buffer.alloc(10 * 1024 * 1024 + 1),
      )
    ).statusCode,
    413,
  );
});
test("kategori manual terpisah dari prediksi asli", async () => {
  prediction = {
    category: "plastic",
    confidence: 0.64,
    model_version: "test-double",
    probabilities: { organic: 0.2, paper: 0.16, plastic: 0.64 },
    outcome: "predicted",
  };
  const result = await report(bearer(await auth()), { category: "paper" });
  assert.equal(result.json().category, "paper");
  assert.equal(result.json().predictions[0].category, "plastic");
});
test("pembatasan login dan rentang tanggal", async () => {
  const headers = bearer(await auth());
  assert.equal(
    (
      await request(
        "GET",
        "/api/v1/reports?start_date=2026-12-01&end_date=2026-01-01",
        undefined,
        headers,
      )
    ).statusCode,
    422,
  );
  for (let i = 0; i < 9; i++)
    assert.equal(
      (
        await request("POST", "/api/v1/auth/login", {
          email: "no@example.com",
          password: "bad",
        })
      ).statusCode,
      401,
    );
  assert.equal(
    (
      await request("POST", "/api/v1/auth/login", {
        email: "no@example.com",
        password: "bad",
      })
    ).statusCode,
    429,
  );
});
test("migrasi berulang aman dan semua endpoint kontrak terdaftar", async () => {
  await migrate(pool);
  assert.equal(
    Number((await pool.query("SELECT count(*) FROM users")).rows[0].count),
    1,
  );
  for (const [path, methods] of Object.entries(contract.paths) as [
    string,
    Record<string, unknown>,
  ][]) {
    for (const method of Object.keys(methods)) {
      if (!["get", "post", "patch", "delete"].includes(method)) continue;
      if (path === "/api/health" || path === "/api/ready") continue;
      assert.equal(
        app.hasRoute({
          method: method.toUpperCase() as any,
          url: path.replace(/\{([^}]+)\}/g, ":$1"),
        }),
        true,
        `${method} ${path}`,
      );
    }
  }
});

test("refresh serentak hanya berhasil sekali dan replay mencabut akses", async () => {
  const session = await auth();
  const results = await Promise.all(
    [1, 2].map(() =>
      request(
        "POST",
        "/api/v1/auth/refresh",
        { refresh_token: session.refresh_token },
        { "x-client-type": "mobile" },
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 401]);
  const issued = results.find((r) => r.statusCode === 200)!.json();
  assert.equal(
    (await request("GET", "/api/v1/auth/me", undefined, bearer(issued)))
      .statusCode,
    401,
  );
});

test("perubahan Admin serentak tetap menyisakan satu Admin aktif", async () => {
  const headers = await admin();
  const first = (
    await request("GET", "/api/v1/auth/me", undefined, headers)
  ).json();
  const second = await request(
    "POST",
    "/api/v1/users",
    {
      name: "Admin kedua",
      email: "second@example.com",
      password: "SecondAdminPassword123",
      role: "admin",
    },
    headers,
  );
  assert.equal(second.statusCode, 201);
  const responses = await Promise.all(
    [first.id, second.json().id].map((id) =>
      request(
        "PATCH",
        `/api/v1/users/${id}`,
        { name: "Admin", role: "user", active: true },
        headers,
      ),
    ),
  );
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM users WHERE role='admin' AND active=true",
        )
      ).rows[0].count,
    ),
    1,
  );
});

test("prediksi memerlukan sesi, fallback 503, dan kategori asli dikembalikan", async () => {
  assert.equal((await report({}, {}, "/api/v1/predictions")).statusCode, 401);
  const headers = bearer(await auth());
  assert.equal(
    (await report(headers, {}, "/api/v1/predictions")).statusCode,
    503,
  );
  prediction = {
    category: "plastic",
    confidence: 0.64,
    model_version: "test-double",
    probabilities: { organic: 0.2, paper: 0.16, plastic: 0.64 },
    outcome: "predicted",
  };
  const result = await report(headers, {}, "/api/v1/predictions");
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().category, "plastic");
});

test("JSON rusak tidak membocorkan input dan ID invalid ditolak", async () => {
  const invalid = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { "content-type": "application/json" },
    payload: '{"password":"SensitivePassword" invalid}',
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.includes("SensitivePassword"), false);
  assert.equal(
    (
      await request(
        "GET",
        "/api/v1/reports/invalid",
        undefined,
        bearer(await auth()),
      )
    ).statusCode,
    422,
  );
});
