import { ReportForm } from "@/components/report-form";
export default function NewReport() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Laporkan kondisi di sekitar Anda</p>
          <h1>Buat laporan sampah</h1>
          <p className="muted">
            Lengkapi foto, keterangan, dan lokasi penemuan.
          </p>
        </div>
      </header>
      <ReportForm />
    </>
  );
}
