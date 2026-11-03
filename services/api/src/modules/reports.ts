import { randomUUID } from "node:crypto";
import { route, type Context } from "../context.js";
import { validateRequest } from "../contract.js";
import { transaction } from "../database.js";
import { HttpError } from "../errors.js";
import { Media, upload } from "../media.js";
import {
  publicReport,
  type Category,
  type Report,
  type Status,
} from "../types.js";
import {
  getReport,
  historyRecord,
  predictionRecord,
  reportDetail,
  reportFilter,
} from "./report-store.js";

export function reportRoutes(ctx: Context) {
  const { pool, config, ml } = ctx;
  const media = new Media(config.storageDir);
  route(ctx, "GET", "/api/v1/reports", "user", async (req) => {
    const filter = req.query as { page: number; page_size: number };
    const { where, values } = reportFilter(req.user, filter);
    const total = Number(
      (await pool.query(`SELECT count(*) FROM reports WHERE ${where}`, values))
        .rows[0].count,
    );
    const items = (
      await pool.query<Report>(
        `SELECT * FROM reports WHERE ${where} ORDER BY created_at DESC,id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, filter.page_size, (filter.page - 1) * filter.page_size],
      )
    ).rows.map(publicReport);
    return { items, total, page: filter.page, page_size: filter.page_size };
  });
  route(ctx, "GET", "/api/v1/reports/{report_id}", "user", async (req) => {
    const { report_id } = req.params as { report_id: string };
    return reportDetail(pool, await getReport(pool, req.user, report_id));
  });
  route(
    ctx,
    "GET",
    "/api/v1/reports/{report_id}/photo",
    "user",
    async (req, reply) => {
      const { report_id } = req.params as { report_id: string };
      const report = await getReport(pool, req.user, report_id);
      return reply
        .type("image/jpeg")
        .header("Cache-Control", "private, no-store")
        .send(await media.read(report.image_path));
    },
  );
  for (const method of ["POST", "PATCH"] as const) {
    const path =
      method === "POST" ? "/api/v1/reports" : "/api/v1/reports/{report_id}";
    route(
      ctx,
      method,
      path,
      "user",
      async (req, reply) => {
        const { fields, raw } = await upload(req);
        validateRequest(req, path, method, fields);
        const body = fields as {
          description: string;
          category: Category;
          latitude: number;
          longitude: number;
          accuracy?: number | null;
        };
        if (body.description.trim().length < 10)
          throw new HttpError(422, "Deskripsi minimal 10 karakter");
        const id =
          method === "POST"
            ? randomUUID()
            : (req.params as { report_id: string }).report_id;
        if (method === "PATCH") await getReport(pool, req.user, id);
        if (method === "POST" && !raw)
          throw new HttpError(422, "Foto wajib diisi");
        const clean = raw ? await media.normalize(raw) : null;
        // Inference receives the original upload so Pillow preprocessing remains identical to Colab.
        const prediction = raw ? await ml.predict(raw) : null;
        const filename = clean ? await media.store(clean) : null;
        try {
          const result = await transaction(pool, async (db) => {
            let report: Report;
            const values = [
              body.description.trim(),
              body.category,
              body.latitude,
              body.longitude,
              body.accuracy ?? null,
            ];
            if (method === "POST") {
              report = (
                await db.query<Report>(
                  `INSERT INTO reports(description,category,latitude,longitude,accuracy,id,owner_id,image_path,status,created_at,updated_at,deleted_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',clock_timestamp(),clock_timestamp(),NULL) RETURNING *`,
                  [...values, id, req.user.id, filename],
                )
              ).rows[0];
              await historyRecord(
                db,
                report,
                req.user.id,
                null,
                "pending",
                "Laporan dibuat",
              );
            } else {
              report = await getReport(db, req.user, id, true);
              if (req.user.role !== "admin" && report.status !== "pending")
                throw new HttpError(
                  409,
                  "Laporan hanya dapat diedit saat Pending",
                );
              report = (
                await db.query<Report>(
                  `UPDATE reports SET description=$1,category=$2,latitude=$3,longitude=$4,accuracy=$5,image_path=$6,updated_at=clock_timestamp() WHERE id=$7 RETURNING *`,
                  [...values, filename || report.image_path, id],
                )
              ).rows[0];
              await historyRecord(
                db,
                report,
                req.user.id,
                report.status,
                report.status,
                "Isi laporan diperbarui",
              );
            }
            if (prediction) await predictionRecord(db, report, prediction);
            return reportDetail(db, report);
          });
          return reply.code(method === "POST" ? 201 : 200).send(result);
        } catch (error) {
          if (filename) await media.remove(filename);
          throw error;
        }
      },
      true,
    );
  }
  route(
    ctx,
    "DELETE",
    "/api/v1/reports/{report_id}",
    "user",
    async (req, reply) => {
      await transaction(pool, async (db) => {
        const report = await getReport(
          db,
          req.user,
          (req.params as { report_id: string }).report_id,
          true,
        );
        if (req.user.role !== "admin" && report.status !== "pending")
          throw new HttpError(409, "Laporan hanya dapat dihapus saat Pending");
        await db.query(
          "UPDATE reports SET deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1",
          [report.id],
        );
        await historyRecord(
          db,
          report,
          req.user.id,
          report.status,
          report.status,
          "Laporan diarsipkan",
        );
      });
      return reply.code(204).send();
    },
  );
  route(
    ctx,
    "PATCH",
    "/api/v1/reports/{report_id}/status",
    "admin",
    async (req) => {
      const body = req.body as { status: Status; note: string };
      return transaction(pool, async (db) => {
        let report = await getReport(
          db,
          req.user,
          (req.params as { report_id: string }).report_id,
          true,
        );
        const allowed: Partial<Record<Status, Status[]>> = {
          pending: ["in_progress", "rejected"],
          in_progress: ["completed", "rejected"],
        };
        if (!allowed[report.status]?.includes(body.status))
          throw new HttpError(409, "Transisi status tidak diizinkan");
        if (body.status === "rejected" && !body.note.trim())
          throw new HttpError(422, "Alasan penolakan wajib diisi");
        await historyRecord(
          db,
          report,
          req.user.id,
          report.status,
          body.status,
          body.note.trim(),
        );
        report = (
          await db.query<Report>(
            "UPDATE reports SET status=$1,updated_at=clock_timestamp() WHERE id=$2 RETURNING *",
            [body.status, report.id],
          )
        ).rows[0];
        return reportDetail(db, report);
      });
    },
  );
}
