"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  categories,
  categoryDescriptions,
  errorMessage,
  mapUrl,
  type Category,
  type Prediction,
  type ReportDetail,
} from "@smart-waste/api-client";
import { api } from "@/lib/api";
import { ErrorBox } from "./ui";
type Location = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};
export function ReportForm({ report }: { report?: ReportDetail }) {
  const router = useRouter();
  const [description, setDescription] = useState(report?.description || "");
  const [category, setCategory] = useState<Category>(
    report?.category || "organic",
  );
  const [location, setLocation] = useState<Location | null>(
    report
      ? {
          latitude: report.latitude,
          longitude: report.longitude,
          accuracy: report.accuracy,
        }
      : null,
  );
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState(
    report ? `/api/v1/reports/${report.id}/photo` : "",
  );
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictBusy, setPredictBusy] = useState(false);
  const [predictError, setPredictError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const predictionAbort = useRef<AbortController | null>(null);
  useEffect(() => () => predictionAbort.current?.abort(), []);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function locate() {
    setLocError("");
    setLocBusy(true);
    if (!navigator.geolocation) {
      setLocError(
        "Perangkat tidak mendukung lokasi. Gunakan perangkat dengan GPS/geolocation.",
      );
      setLocBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
        setLocBusy(false);
      },
      (e) => {
        setLocError(
          e.code === 1
            ? "Izin lokasi ditolak. Izinkan lokasi melalui pengaturan browser, lalu coba lagi."
            : "Lokasi belum diperoleh. Pastikan GPS aktif, lalu coba lagi.",
        );
        setLocBusy(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }
  async function predict() {
    if (!photo) return;
    predictionAbort.current?.abort();
    const controller = new AbortController();
    predictionAbort.current = controller;
    setPredictBusy(true);
    setPredictError("");
    const form = new FormData();
    form.append("photo", photo);
    try {
      const result = await api.request<Prediction>("/predictions", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      setPrediction(result);
      if (result.category) setCategory(result.category);
    } catch (e) {
      if (!controller.signal.aborted) setPredictError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setPredictBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!location) {
      setError("Ambil lokasi GPS sebelum mengirim laporan.");
      return;
    }
    if (!report && !photo) {
      setError("Tambahkan satu foto sampah.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.set("description", description);
    form.set("category", category);
    form.set("latitude", String(location.latitude));
    form.set("longitude", String(location.longitude));
    if (location.accuracy !== null)
      form.set("accuracy", String(location.accuracy));
    if (photo) form.set("photo", photo);
    try {
      const result = await api.request<ReportDetail>(
        report ? `/reports/${report.id}` : "/reports",
        { method: report ? "PATCH" : "POST", body: form },
      );
      router.push(`/reports/${result.id}`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="report-form" onSubmit={submit}>
      <div className="form-main">
        <section className="panel">
          <h2>1. Foto kondisi sampah</h2>
          <p className="muted">
            Satu foto yang jelas. JPEG, PNG, atau WebP, maksimal 10 MB.
          </p>
          {preview && (
            <img
              className="photo-preview"
              src={preview}
              alt="Pratinjau foto laporan"
            />
          )}
          <label>
            Unggah foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required={!report}
              onChange={(e) => {
                predictionAbort.current?.abort();
                setPredictBusy(false);
                setPrediction(null);
                setPredictError("");
                const file = e.target.files?.[0] || null;
                if (file && file.size > 10 * 1024 * 1024) {
                  setError("Foto maksimal 10 MB");
                  e.target.value = "";
                  return;
                }
                setPhoto(file);
                setError("");
              }}
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={!photo || predictBusy}
            onClick={predict}
          >
            {predictBusy ? "Menganalisis foto…" : "Analisis foto dengan AI"}
          </button>
          {predictError && (
            <div className="notice" role="status">
              {predictError} Anda tetap dapat memilih kategori secara manual.
            </div>
          )}
          {prediction && (
            <div className="notice" role="status">
              <strong>
                Saran AI:{" "}
                {prediction.category
                  ? categories[prediction.category]
                  : "Tidak tersedia"}
              </strong>
              <p>
                Confidence {Math.round((prediction.confidence || 0) * 100)}%.{" "}
                {prediction.confidence !== null && prediction.confidence < 0.7
                  ? "Confidence rendah. Periksa dan koreksi kategori."
                  : "Periksa saran sebelum mengirim laporan."}
              </p>
              <small>
                Model {prediction.model_version}. Model hanya mengenali tiga
                kelas dan dapat keliru pada objek lain.
              </small>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>2. Keterangan laporan</h2>
          <label>
            Kategori
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {Object.entries(categories).map(([v, t]) => (
                <option key={v} value={v}>
                  {t} ({categoryDescriptions[v as Category]})
                </option>
              ))}
            </select>
          </label>
          <small>
            Anda menentukan kategori akhir; prediksi asli dicatat terpisah.
          </small>
          <label>
            Deskripsi
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={10}
              maxLength={5000}
              rows={6}
              required
              placeholder="Jelaskan kondisi, jumlah perkiraan, dan petunjuk lokasi sampah."
            />
          </label>
          <small>{description.length}/5000 karakter, minimal 10.</small>
        </section>
      </div>
      <aside className="form-side">
        <section className="panel">
          <h2>3. Lokasi penemuan</h2>
          <p className="muted">
            Ambil lokasi ketika berada di dekat sampah yang dilaporkan.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={locate}
            disabled={locBusy}
          >
            {locBusy
              ? "Mencari lokasi…"
              : location
                ? "Perbarui lokasi GPS"
                : "Ambil lokasi GPS"}
          </button>
          {locError && <ErrorBox message={locError} />}{" "}
          {location && (
            <div className="location-box">
              <p>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
              <small>
                Akurasi:{" "}
                {location.accuracy === null
                  ? "tidak diketahui"
                  : `±${Math.round(location.accuracy)} meter`}
              </small>
              <a
                target="_blank"
                rel="noreferrer"
                href={mapUrl(location.latitude, location.longitude)}
              >
                Lihat di Maps
              </a>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Periksa sebelum mengirim</h2>
          <p className="muted">
            Foto dan koordinat hanya tersedia bagi pemilik laporan serta Admin.
            Hindari foto yang memuat identitas pribadi.
          </p>
          {error && <ErrorBox message={error} />}
          <button disabled={busy || predictBusy}>
            {busy
              ? "Menyimpan…"
              : report
                ? "Simpan perubahan"
                : "Kirim laporan"}
          </button>
          <Link
            className="cancel"
            href={report ? `/reports/${report.id}` : "/reports"}
          >
            Batal
          </Link>
        </section>
      </aside>
    </form>
  );
}
