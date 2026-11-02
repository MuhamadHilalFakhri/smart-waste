"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  categories,
  errorMessage,
  mapUrl,
  statuses,
  transitions,
  type ReportDetail,
  type Status,
} from "@smart-waste/api-client";
import { useAuth } from "@/components/auth";
import {
  Empty,
  ErrorBox,
  Loading,
  StatusLabel,
  useResource,
} from "@/components/ui";
import { api, dateLabel } from "@/lib/api";
export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const resource = useResource<ReportDetail>(`/reports/${id}`);
  const { data, error, loading, reload } = resource;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!data) return null;
  const editable = user?.role === "admin" || data.status === "pending";
  async function archive() {
    if (
      !window.confirm(
        "Arsipkan laporan ini? Laporan tidak akan muncul di daftar aktif.",
      )
    )
      return;
    setBusy(true);
    try {
      await api.request(`/reports/${id}`, { method: "DELETE" });
      router.push("/reports");
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/reports" className="back-link">
        Kembali ke laporan
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Laporan #{data.id.slice(0, 8)}</p>
          <h1>Detail laporan</h1>
          <p className="muted">Dikirim {dateLabel(data.created_at)}</p>
        </div>
        <StatusLabel status={data.status} />
      </header>
      <div className="detail-grid">
        <section className="panel">
          <img
            className="detail-photo"
            src={`/api/v1/reports/${data.id}/photo?v=${encodeURIComponent(data.updated_at)}`}
            alt="Kondisi sampah pada laporan"
          />
          <div className="between">
            <h2>{categories[data.category]}</h2>
            <small>Kategori akhir pelapor</small>
          </div>
          <p className="description">{data.description}</p>
          <div className="location-box">
            <strong>Lokasi penemuan</strong>
            <p>
              {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
            </p>
            <small>
              Akurasi{" "}
              {data.accuracy === null
                ? "tidak diketahui"
                : `±${Math.round(data.accuracy)} m`}
            </small>
            <a
              href={mapUrl(data.latitude, data.longitude)}
              target="_blank"
              rel="noreferrer"
            >
              Buka lokasi di Maps
            </a>
          </div>
          {editable && (
            <div className="actions">
              <Link className="button secondary" href={`/reports/${id}/edit`}>
                Edit laporan
              </Link>
              <button disabled={busy} className="danger" onClick={archive}>
                Arsipkan laporan
              </button>
            </div>
          )}
        </section>
        <div>
          <section className="panel">
            <h2>Riwayat penanganan</h2>
            <ol className="timeline">
              {data.history.map((item) => (
                <li key={item.id}>
                  <b>
                    {statuses[item.next_status as Status] || item.next_status}
                  </b>
                  <time>{dateLabel(item.created_at)}</time>
                  <p>{item.note || "Status diperbarui"}</p>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel">
            <h2>Catatan prediksi AI</h2>
            {data.predictions.length === 0 ? (
              <Empty title="Belum ada prediksi" />
            ) : (
              data.predictions.map((p, i) => (
                <div className="prediction-audit" key={p.id}>
                  <strong>
                    {i === 0 ? "Prediksi foto terbaru" : "Prediksi sebelumnya"}
                  </strong>
                  <p>
                    {p.category
                      ? `${categories[p.category]} · ${Math.round((p.confidence || 0) * 100)}%`
                      : "Model belum tersedia atau prediksi gagal"}
                  </p>
                  <small>
                    {dateLabel(p.created_at)} ·{" "}
                    {p.model_version || "Belum ada model"}
                  </small>
                </div>
              ))
            )}
          </section>
          {user?.role === "admin" && transitions[data.status].length > 0 && (
            <section className="panel">
              <h2>Perbarui status</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setActionError("");
                  const body = new FormData(e.currentTarget);
                  try {
                    await api.request(`/reports/${id}/status`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        status: body.get("status"),
                        note: body.get("note"),
                      }),
                    });
                    reload();
                  } catch (e) {
                    setActionError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Status berikutnya
                  <select name="status">
                    {transitions[data.status].map((s) => (
                      <option key={s} value={s}>
                        {statuses[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Catatan / alasan penolakan
                  <textarea name="note" rows={3} maxLength={2000} />
                  <small>Wajib untuk status Ditolak.</small>
                </label>
                <button disabled={busy}>
                  {busy ? "Menyimpan…" : "Simpan status"}
                </button>
              </form>
            </section>
          )}
          {actionError && <ErrorBox message={actionError} />}
        </div>
      </div>
    </>
  );
}
