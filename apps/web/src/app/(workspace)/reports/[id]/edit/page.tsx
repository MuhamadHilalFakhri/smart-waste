"use client";
import { useParams } from "next/navigation";
import type { ReportDetail } from "@smart-waste/api-client";
import { useAuth } from "@/components/auth";
import { ErrorBox, Loading, useResource } from "@/components/ui";
import { ReportForm } from "@/components/report-form";
export default function Edit() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, error, loading, reload } = useResource<ReportDetail>(
    `/reports/${id}`,
  );
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!data) return null;
  if (user?.role !== "admin" && data.status !== "pending")
    return (
      <ErrorBox message="Laporan ini sudah diproses dan tidak dapat diedit." />
    );
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Laporan #{id.slice(0, 8)}</p>
          <h1>Edit laporan</h1>
        </div>
      </header>
      <ReportForm report={data} />
    </>
  );
}
