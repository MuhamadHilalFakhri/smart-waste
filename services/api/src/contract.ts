import { readFileSync } from "node:fs";
import { Ajv, type ValidateFunction } from "ajv";
import formats from "ajv-formats";
import type { FastifyRequest } from "fastify";
import { HttpError } from "./errors.js";

export const contract = JSON.parse(
  readFileSync(new URL("../openapi.json", import.meta.url), "utf8"),
);
function compiler(coerceTypes: boolean) {
  const ajv = new Ajv({
    strict: false,
    coerceTypes,
    useDefaults: true,
    allErrors: true,
  });
  (formats as unknown as (ajv: Ajv) => void)(ajv);
  ajv.addSchema(contract, "contract");
  return ajv;
}
const bodyCompiler = compiler(false),
  queryCompiler = compiler(true);
const cache = new Map<string, ValidateFunction>();
export function validate(schema: object, value: unknown, coerce = false) {
  const key = JSON.stringify(schema) + coerce;
  let check = cache.get(key);
  if (!check) {
    const portable = JSON.parse(
      JSON.stringify(schema).replaceAll(
        '"#/components/',
        '"contract#/components/',
      ),
    );
    check = (coerce ? queryCompiler : bodyCompiler).compile(portable);
    cache.set(key, check);
  }
  if (!check(value)) throw new HttpError(422, "Periksa data yang diisi");
}
export function validateRequest(
  request: FastifyRequest,
  path: string,
  method: string,
  multipartBody?: Record<string, unknown>,
) {
  const operation = contract.paths[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`Kontrak belum ada: ${method} ${path}`);
  for (const location of ["query", "path"]) {
    const parameters = (operation.parameters || []).filter(
      (p: any) => p.in === location,
    );
    const schema = {
      type: "object",
      properties: Object.fromEntries(
        parameters.map((p: any) => [p.name, p.schema]),
      ),
      required: parameters
        .filter((p: any) => p.required)
        .map((p: any) => p.name),
    };
    validate(
      schema,
      location === "query" ? request.query : request.params,
      location === "query",
    );
  }
  if (operation.requestBody) {
    const content = operation.requestBody.content;
    validate(
      (content["application/json"] || content["multipart/form-data"]).schema,
      multipartBody || request.body,
      !!multipartBody,
    );
  }
}
