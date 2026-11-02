"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "@smart-waste/api-client";
import { useAuth } from "./auth";
import { api } from "@/lib/api";
import { ErrorBox } from "./ui";
export function AuthForm({ register = false }: { register?: boolean }) {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const user = await api.authenticate(register ? "register" : "login", {
        email: String(data.get("email")),
        password: String(data.get("password")),
        ...(register ? { name: String(data.get("name")) } : {}),
      });
      setUser(user);
      router.replace("/dashboard");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page">
      <section className="auth-story">
        <span className="wordmark">
          Smart<span>Waste</span>
        </span>
        <p className="eyebrow">Pelaporan lingkungan</p>
        <h1>
          Satu laporan.
          <br />
          Langkah nyata untuk lingkungan.
        </h1>
        <p>
          Catat sampah di sekitar Anda. Sertakan foto dan lokasi, lalu pantau
          tindak lanjutnya dalam satu tempat.
        </p>
        <div className="material-list">
          <span>Organik</span>
          <span>Plastik</span>
          <span>Kertas</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="form-card">
          <p className="eyebrow">
            {register ? "Mulai berpartisipasi" : "Selamat datang kembali"}
          </p>
          <h2>{register ? "Buat akun pelapor" : "Masuk ke Smart Waste"}</h2>
          <p className="muted">
            {register
              ? "Akun Anda dapat digunakan di website dan aplikasi Android."
              : "Gunakan email dan password akun Anda."}
          </p>
          {error && <ErrorBox message={error} />}
          <form onSubmit={submit}>
            {register && (
              <label>
                Nama lengkap
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 10 : 1}
                maxLength={128}
              />
              {register && <small>Minimal 10 karakter.</small>}
            </label>
            <button disabled={busy}>
              {busy ? "Memproses…" : register ? "Buat akun" : "Masuk"}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Masuk" : "Daftar sebagai pelapor"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
