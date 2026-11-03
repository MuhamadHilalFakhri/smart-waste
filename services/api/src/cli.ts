import { writeFile } from "node:fs/promises";
import { config } from "./config.js";
import { createPool, migrate } from "./database.js";
import { seedAdmin } from "./seed.js";
import { contract } from "./contract.js";

const command = process.argv[2];
if (command === "openapi") {
  await writeFile(
    new URL("../../../packages/api-client/openapi.json", import.meta.url),
    JSON.stringify(contract, null, 2) + "\n",
  );
} else {
  const settings = config();
  const pool = createPool(settings.databaseUrl);
  try {
    if (command === "migrate") await migrate(pool);
    else if (command === "seed-admin") await seedAdmin(pool, settings);
    else throw new Error("Gunakan: migrate, seed-admin, atau openapi");
  } finally {
    await pool.end();
  }
}
