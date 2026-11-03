import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
} from "fastify";
import type { Pool } from "pg";
import type { Config } from "./config.js";
import type { Security } from "./security.js";
import type { MlService } from "./ml.js";
import { validateRequest } from "./contract.js";

export interface Context {
  app: FastifyInstance;
  pool: Pool;
  config: Config;
  security: Security;
  ml: MlService;
}
export function route(
  ctx: Context,
  method: HTTPMethods,
  path: string,
  permission: "public" | "user" | "admin",
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
  multipart = false,
) {
  ctx.app.route({
    method,
    url: path.replace(/\{([^}]+)\}/g, ":$1"),
    onRequest: async (request) => {
      if (permission !== "public")
        await ctx.security.authenticate(request, permission === "admin");
    },
    handler: async (request, reply) => {
      if (!multipart) validateRequest(request, path, method);
      return handler(request, reply);
    },
  });
}
