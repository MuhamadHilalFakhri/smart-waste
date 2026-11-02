"use client";
import Link from "next/link";
import { useState } from "react";
import {
  categories,
  statuses,
  type Dashboard,
  type Status,
  type Category,
} from "@smart-waste/api-client";
import { useAuth } from "@/components/auth";
import { Empty, ErrorBox, Loading, useResource } from "@/components/ui";
export default function DashboardPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState("");
  const { data, error, loading, reload } = useResource<Dashboard>(
    `/dashboard${filters}`,
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            {user?.role === "admin"
              ? "Pemantauan operasional"
              : "Ruang pelapor"}
          </p>
          <h1>Ringkasan laporan</h1>
          <p className="muted">
            {user?.role === "admin"
              ? "Pantau laporan masuk dan tindak lanjut di lapangan."
              : "Lihat perkembangan laporan yang telah Anda kirim."}
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
          setFilters(`?${p}`);
        }}
      >
        <label>
          Dari tanggal
          <input type="date" name="start_date" />
        </label>
        <label>
          Sampai tanggal
          <input type="date" name="end_date" />
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
        <button className="secondary">Terapkan</button>
      </form>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        data && (
          <>
            <section className="summary-band">
              <div>
                <span>Total laporan</span>
                <strong>{data.total}</strong>
                <small>Sesuai filter dan hak akses akun Anda</small>
              </div>
              <p>
                Setiap laporan dimulai dari <b>Menunggu</b>, kemudian ditinjau
                Admin sebelum ditindaklanjuti.
              </p>
            </section>
            <section
              className="stats-grid"
              aria-label="Jumlah berdasarkan status"
            >
              {Object.entries(statuses).map(([key, label]) => (
                <Link
                  href={`/reports?status=${key}`}
                  className={`stat ${key}`}
                  key={key}
                >
                  <span>{label}</span>
                  <strong>{data.by_status[key as Status] ?? 0}</strong>
                  <small>Lihat laporan</small>
                </Link>
              ))}
            </section>
            {data.total === 0 ? (
              <Empty title="Belum ada laporan pada rentang ini">
                Mulai dengan mengirim foto dan lokasi sampah yang Anda temukan.
              </Empty>
            ) : (
              <div className="dashboard-columns">
                <section className="panel">
                  <h2>Komposisi kategori</h2>
                  <p className="muted">Kategori yang dikonfirmasi pelapor.</p>
                  {Object.entries(categories).map(([key, label]) => (
                    <div className="bar-row" key={key}>
                      <span>{label}</span>
                      <meter
                        min={0}
                        max={data.total || 1}
                        value={data.by_category[key as Category] ?? 0}
                        aria-label={label}
                      />
                      <b>{data.by_category[key as Category] ?? 0}</b>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2>Aktivitas laporan</h2>
                  <p className="muted">
                    Maksimal 30 tanggal aktif terakhir, dikelompokkan
                    berdasarkan UTC.
                  </p>
                  <ol className="activity">
                    {data.by_day.map((item) => (
                      <li key={String(item.date)}>
                        <span>{String(item.date)}</span>
                        <b>{item.count} laporan</b>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )}
          </>
        )
      )}
    </>
  );
}
