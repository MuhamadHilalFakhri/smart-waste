"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { categories, statuses, type ReportPage } from "@smart-waste/api-client";
import {
  Empty,
  ErrorBox,
  Loading,
  StatusLabel,
  useResource,
} from "@/components/ui";
import { dateLabel } from "@/lib/api";
export default function ReportsPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).toString());
  }, []);
  const { data, error, loading, reload } = useResource<ReportPage>(
    `/reports?${query}&page=${page}`,
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Foto, lokasi, tindak lanjut</p>
          <h1>Laporan sampah</h1>
          <p className="muted">
            Cari laporan dan ikuti perkembangan penanganannya.
          </p>
        </div>
        <Link className="button" href="/reports/new">
          Buat laporan
        </Link>
      </header>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const p = new URLSearchParams();
          for (const [k, v] of f) if (v) p.set(k, String(v));
          setPage(1);
          setQuery(p.toString());
        }}
      >
        <label className="grow">
          Cari laporan
          <input
            name="q"
            placeholder="Deskripsi atau ID lengkap"
            maxLength={200}
          />
        </label>
        <label>
          Status
          <select
            name="status"
            defaultValue={
              typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("status") ||
                  ""
                : ""
            }
          >
            <option value="">Semua status</option>
            {Object.entries(statuses).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kategori
          <select name="category">
            <option value="">Semua kategori</option>
            {Object.entries(categories).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dari
          <input type="date" name="start_date" />
        </label>
        <label>
          Sampai
          <input type="date" name="end_date" />
        </label>
        <button className="secondary">Cari laporan</button>
        <button
          type="reset"
          className="quiet"
          onClick={() => {
            setPage(1);
            setQuery("");
          }}
        >
          Reset
        </button>
      </form>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        data && (
          <>
            <div className="list-heading">
              <p>{data.total} laporan ditemukan</p>
              <span className="muted">Terbaru lebih dahulu</span>
            </div>
            {data.items.length === 0 ? (
              <Empty title="Tidak ada laporan">
                Buat laporan baru atau sesuaikan filter pencarian.
              </Empty>
            ) : (
              <div className="report-grid">
                {data.items.map((report) => (
                  <Link
                    className="report-card"
                    key={report.id}
                    href={`/reports/${report.id}`}
                  >
                    <div className="report-photo">
                      <img
                        src={`/api/v1/reports/${report.id}/photo?v=${encodeURIComponent(report.updated_at)}`}
                        alt="Foto sampah yang dilaporkan"
                        loading="lazy"
                      />
                    </div>
                    <div className="report-card-body">
                      <div className="between">
                        <StatusLabel status={report.status} />
                        <small>{categories[report.category]}</small>
                      </div>
                      <h2>{report.description}</h2>
                      <p className="muted">{dateLabel(report.created_at)}</p>
                      <small className="report-number">
                        #{report.id.slice(0, 8)}
                      </small>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="pagination">
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </button>
              <span>
                Halaman {page} dari{" "}
                {Math.max(1, Math.ceil(data.total / data.page_size))}
              </span>
              <button
                className="secondary"
                disabled={page * data.page_size >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </button>
            </div>
          </>
        )
      )}
    </>
  );
}
