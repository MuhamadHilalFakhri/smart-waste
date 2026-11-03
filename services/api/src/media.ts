import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { FastifyRequest } from "fastify";
import { HttpError } from "./errors.js";

export const MAX_UPLOAD = 10 * 1024 * 1024;
export async function upload(request: FastifyRequest) {
  const fields: Record<string, unknown> = {};
  let raw: Buffer | undefined;
  if (request.isMultipart()) {
    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "photo" || raw)
          throw new HttpError(422, "Sertakan satu foto sampah");
        raw = await part.toBuffer();
        fields.photo = "upload";
      } else {
        if (Object.hasOwn(fields, part.fieldname))
          throw new HttpError(422, "Field tidak boleh berulang");
        fields[part.fieldname] = part.value;
      }
    }
  } else Object.assign(fields, request.body);
  return { fields, raw };
}
export class Media {
  constructor(private root: string) {}
  async normalize(raw: Buffer) {
    if (raw.length > MAX_UPLOAD)
      throw new HttpError(413, "Foto maksimal 10 MB");
    try {
      const image = sharp(raw, {
        limitInputPixels: 25000000,
        failOn: "warning",
        animated: false,
      });
      const metadata = await image.metadata();
      if (
        !["jpeg", "png", "webp"].includes(metadata.format || "") ||
        (metadata.pages || 1) > 1
      )
        throw new HttpError(422, "Gunakan satu foto JPEG, PNG, atau WebP");
      // Sharp strips EXIF by default; auto-orient before resizing and encoding.
      return await image
        .rotate()
        .removeAlpha()
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(422, "Foto rusak atau ukurannya tidak didukung");
    }
  }
  async store(image: Buffer) {
    await mkdir(this.root, { recursive: true });
    const filename = `${randomUUID()}.jpg`;
    await writeFile(join(this.root, filename), image, { flag: "wx" });
    return filename;
  }
  private path(filename: string) {
    if (!/^[0-9a-f-]{36}\.jpg$/i.test(filename))
      throw new HttpError(404, "Foto tidak ditemukan");
    return join(this.root, filename);
  }
  async read(filename: string) {
    try {
      return await readFile(this.path(filename));
    } catch {
      throw new HttpError(404, "Foto tidak ditemukan");
    }
  }
  async remove(filename: string) {
    await unlink(this.path(filename)).catch(() => {});
  }
}
