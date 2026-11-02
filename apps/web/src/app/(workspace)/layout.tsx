"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { ErrorBox, Loading } from "@/components/ui";
import { api } from "@/lib/api";
export default function Workspace({ children }: { children: React.ReactNode }) {
  const { user, loading, error, reload, setUser } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    if (!loading && !user && !error) router.replace("/login");
  }, [loading, user, error, router]);
  if (loading)
    return (
      <main id="main" className="centered">
        <Loading />
      </main>
    );
  if (error)
    return (
      <main id="main" className="centered">
        <ErrorBox message={error} retry={reload} />
      </main>
    );
  if (!user) return null;
  const links = [
    ["/dashboard", "Ringkasan"],
    ["/reports", "Laporan"],
    ...(user.role === "admin" ? [["/users", "Pengguna"]] : []),
  ];
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="wordmark" href="/dashboard">
          Smart<span>Waste</span>
          <small>Lingkungan mulai dari laporan.</small>
        </Link>
        <nav aria-label="Navigasi utama">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="account">
          <strong>{user.name}</strong>
          <span>{user.role === "admin" ? "Administrator" : "Pelapor"}</span>
          <button
            disabled={busy}
            className="secondary"
            onClick={async () => {
              setBusy(true);
              setLogoutError("");
              try {
                await api.logout();
                setUser(null);
                router.replace("/login");
              } catch {
                setLogoutError("Keluar gagal. Coba lagi.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Memproses…" : "Keluar"}
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </aside>
      <main id="main" className="content">
        {children}
      </main>
    </div>
  );
}
