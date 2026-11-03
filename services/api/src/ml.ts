import type { Config } from "./config.js";
import type { Prediction } from "./types.js";
import { validate } from "./contract.js";

export const unavailable = (): Prediction => ({
  category: null,
  confidence: null,
  model_version: null,
  probabilities: {},
  outcome: "unavailable",
});
export class MlClient {
  constructor(private config: Config) {}
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.mlUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return (
        response.ok &&
        ((await response.json()) as { model_loaded?: boolean }).model_loaded ===
          true
      );
    } catch {
      return false;
    }
  }
  async predict(raw: Buffer): Promise<Prediction> {
    try {
      const body = new FormData();
      body.append("photo", new Blob([new Uint8Array(raw)]), "photo");
      const response = await fetch(`${this.config.mlUrl}/predict`, {
        method: "POST",
        headers: { "X-ML-Service-Token": this.config.mlToken },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return unavailable();
      const result: unknown = await response.json();
      validate({ $ref: "#/components/schemas/PredictionOut" }, result);
      return result as Prediction;
    } catch {
      return unavailable();
    }
  }
}
export type MlService = Pick<MlClient, "predict" | "health">;
