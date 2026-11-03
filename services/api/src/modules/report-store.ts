import { randomUUID } from "node:crypto";
import type { Db } from "../database.js";
import { HttpError } from "../errors.js";
import {
  publicReport,
  type Prediction,
  type Report,
  type User,
} from "../types.js";
import { escapedSearch } from "./users.js";

export async function getReport(db: Db, user: User, id: string, lock = false) {
  const result = await db.query<Report>(
    `SELECT * FROM reports WHERE id=$1 AND deleted_at IS NULL AND ($2='admin' OR owner_id=$3) ${lock ? "FOR UPDATE" : ""}`,
    [id, user.role, user.id],
  );
  if (!result.rows[0]) throw new HttpError(404, "Laporan tidak ditemukan");
  return result.rows[0];
}
export function reportFilter(user: User, filter: Record<string, any>) {
  const values: unknown[] = [],
    parts = ["deleted_at IS NULL"];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (user.role !== "admin") parts.push(`owner_id=${bind(user.id)}`);
  if (filter.q) {
    const search = `description ILIKE ${bind(escapedSearch(filter.q))}`;
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        filter.q,
      )
    )
      parts.push(`(${search} OR id=${bind(filter.q)})`);
    else parts.push(search);
  }
  if (filter.status) parts.push(`status=${bind(filter.status)}`);
  if (filter.category) parts.push(`category=${bind(filter.category)}`);
  if (
    filter.start_date &&
    filter.end_date &&
    filter.start_date > filter.end_date
  )
    throw new HttpError(422, "Tanggal awal tidak boleh setelah tanggal akhir");
  if (filter.start_date)
    parts.push(
      `created_at>=${bind(filter.start_date + "T00:00:00Z")}::timestamptz`,
    );
  if (filter.end_date)
    parts.push(
      `created_at<(${bind(filter.end_date + "T00:00:00Z")}::timestamptz + interval '1 day')`,
    );
  return { where: parts.join(" AND "), values };
}
export async function reportDetail(db: Db, report: Report) {
  const history = (
    await db.query(
      "SELECT id,actor_id,previous_status,next_status,note,created_at FROM report_status_history WHERE report_id=$1 ORDER BY created_at,id",
      [report.id],
    )
  ).rows;
  const predictions = (
    await db.query(
      "SELECT id,category,confidence,model_version,outcome,probabilities_json,created_at FROM predictions WHERE report_id=$1 ORDER BY created_at DESC,id",
      [report.id],
    )
  ).rows.map(({ probabilities_json, ...p }) => ({
    ...p,
    probabilities: JSON.parse(probabilities_json),
  }));
  return { ...publicReport(report), history, predictions };
}
export async function predictionRecord(
  db: Db,
  report: Report,
  prediction: Prediction,
) {
  await db.query(
    `INSERT INTO predictions(id,report_id,image_path,category,confidence,model_version,outcome,probabilities_json,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
    [
      randomUUID(),
      report.id,
      report.image_path,
      prediction.category,
      prediction.confidence,
      prediction.model_version,
      prediction.outcome,
      JSON.stringify(prediction.probabilities),
    ],
  );
}
export async function historyRecord(
  db: Db,
  report: Report,
  actorId: string,
  previous: string | null,
  next: string,
  note: string,
) {
  await db.query(
    "INSERT INTO report_status_history(id,report_id,actor_id,previous_status,next_status,note,created_at) VALUES($1,$2,$3,$4,$5,$6,clock_timestamp())",
    [randomUUID(), report.id, actorId, previous, next, note],
  );
}
