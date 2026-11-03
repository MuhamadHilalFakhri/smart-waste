import { route, type Context } from "../context.js";
import { validateRequest } from "../contract.js";
import { HttpError } from "../errors.js";
import { Media, upload } from "../media.js";

export function predictionRoutes(ctx: Context) {
  route(
    ctx,
    "POST",
    "/api/v1/predictions",
    "user",
    async (req) => {
      const { fields, raw } = await upload(req);
      validateRequest(req, "/api/v1/predictions", "POST", fields);
      if (!raw) throw new HttpError(422, "Foto wajib diisi");
      await new Media(ctx.config.storageDir).normalize(raw);
      const result = await ctx.ml.predict(raw);
      if (result.outcome !== "predicted")
        throw new HttpError(
          503,
          "Prediksi belum tersedia. Pilih kategori secara manual.",
        );
      return result;
    },
    true,
  );
}
