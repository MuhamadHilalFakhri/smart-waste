import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { Media } from "../src/media.js";
import { MlClient } from "../src/ml.js";
import { config } from "../src/config.js";

test("foto dibatasi, diputar, diperkecil, dan metadata dibuang", async () => {
  const media = new Media("unused");
  const raw = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "green" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const clean = await media.normalize(raw);
  const meta = await sharp(clean).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.height, 2048);
  assert.equal(meta.width, 1024);
  assert.equal(meta.exif, undefined);
  await assert.rejects(media.normalize(Buffer.from("invalid")), {
    statusCode: 422,
  });
  await assert.rejects(media.normalize(Buffer.alloc(10 * 1024 * 1024 + 1)), {
    statusCode: 413,
  });
});

test("layanan ML terputus menghasilkan fallback manual", async () => {
  const settings = config({
    JWT_SECRET: "unit-only-jwt-secret-at-least-32-characters",
    ML_SERVICE_TOKEN: "unit-only-ml-token-at-least-32-characters",
    DATABASE_URL: "postgresql://localhost/unused",
    ML_SERVICE_URL: "http://127.0.0.1:1",
  });
  const ml = new MlClient(settings);
  assert.equal(await ml.health(), false);
  assert.equal((await ml.predict(Buffer.from("photo"))).outcome, "unavailable");
});
