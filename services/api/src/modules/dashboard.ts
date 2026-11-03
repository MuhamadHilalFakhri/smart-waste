import { route, type Context } from "../context.js";
import { reportFilter } from "./report-store.js";

export function dashboardRoutes(ctx: Context) {
  route(ctx, "GET", "/api/v1/dashboard", "user", async (req) => {
    const { where, values } = reportFilter(
      req.user,
      req.query as Record<string, unknown>,
    );
    const [statuses, categories, days] = await Promise.all([
      ctx.pool.query(
        `SELECT status,count(*) FROM reports WHERE ${where} GROUP BY status`,
        values,
      ),
      ctx.pool.query(
        `SELECT category,count(*) FROM reports WHERE ${where} GROUP BY category`,
        values,
      ),
      ctx.pool.query(
        `SELECT (created_at AT TIME ZONE 'UTC')::date::text AS date,count(*) FROM reports WHERE ${where} GROUP BY date ORDER BY date DESC LIMIT 30`,
        values,
      ),
    ]);
    const by_status: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
    };
    const by_category: Record<string, number> = {
      organic: 0,
      plastic: 0,
      paper: 0,
    };
    for (const row of statuses.rows) by_status[row.status] = Number(row.count);
    for (const row of categories.rows)
      by_category[row.category] = Number(row.count);
    return {
      total: Object.values(by_status).reduce((a, b) => a + b, 0),
      by_status,
      by_category,
      by_day: days.rows
        .reverse()
        .map((row) => ({ date: row.date, count: Number(row.count) })),
    };
  });
}
