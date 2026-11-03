import { buildApp } from "./app.js";
import { config } from "./config.js";

const settings = config();
const app = await buildApp(settings);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ host: settings.host, port: settings.port });
