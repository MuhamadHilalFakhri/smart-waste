"use client";
import { useState } from "react";
import {
  errorMessage,
  type User,
  type UserPage,
} from "@smart-waste/api-client";
import { useAuth } from "@/components/auth";
import { Empty, ErrorBox, Loading, useResource } from "@/components/ui";
import { api } from "@/lib/api";
export default function Users() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const { data, error, loading, reload } = useResource<UserPage>(
    user?.role === "admin"
      ? `/users?q=${encodeURIComponent(q)}&page=${page}`
      : null,
  );
  if (user?.role !== "admin") return <ErrorBox message="Akses khusus Admin" />;
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administrasi akun</p>
          <h1>Manajemen pengguna</h1>
          <p className="muted">
            Kelola akses dan nonaktifkan akun yang tidak lagi digunakan.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(!showCreate);
            setEditing(null);
            setActionError("");
          }}
        >
          {showCreate ? "Tutup formulir" : "Tambah pengguna"}
        </button>
      </header>
      {actionError && <ErrorBox message={actionError} />}{" "}
      {success && (
        <p className="notice" role="status">
          {success}
        </p>
      )}
      {(showCreate || editing) && (
        <section className="panel">
          <h2>{editing ? "Edit pengguna" : "Pengguna baru"}</h2>
          <form
            className="user-form"
            key={editing?.id || "new"}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setActionError("");
              setSuccess("");
              try {
                const body = editing
                  ? {
                      name: f.get("name"),
                      role: f.get("role"),
                      active: f.get("active") === "on",
                    }
                  : {
                      name: f.get("name"),
                      email: f.get("email"),
                      password: f.get("password"),
                      role: f.get("role"),
                    };
                await api.request(editing ? `/users/${editing.id}` : "/users", {
                  method: editing ? "PATCH" : "POST",
                  body: JSON.stringify(body),
                });
                setEditing(null);
                setShowCreate(false);
                setSuccess("Data pengguna disimpan.");
                reload();
              } catch (e) {
                setActionError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nama
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={editing?.name}
              />
            </label>
            {!editing && (
              <>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Password awal
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                  />
                </label>
              </>
            )}
            <label>
              Role
              <select name="role" defaultValue={editing?.role || "user"}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {editing && (
              <label className="check">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={editing.active}
                />
                Akun aktif
              </label>
            )}
            <div className="actions">
              <button disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan pengguna"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setShowCreate(false);
                }}
              >
                Batal
              </button>
            </div>
          </form>
        </section>
      )}
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(String(new FormData(e.currentTarget).get("q") || ""));
        }}
      >
        <label className="grow">
          Cari nama atau email
          <input name="q" maxLength={100} />
        </label>
        <button className="secondary">Cari pengguna</button>
      </form>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        data && (
          <>
            {data.items.length === 0 ? (
              <Empty title="Pengguna tidak ditemukan" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pengguna</th>
                      <th>Role</th>
                      <th>Akses</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <b>{item.name}</b>
                          <small>{item.email}</small>
                        </td>
                        <td>{item.role}</td>
                        <td>{item.active ? "Aktif" : "Nonaktif"}</td>
                        <td>
                          <button
                            className="secondary"
                            onClick={() => {
                              setEditing(item);
                              setShowCreate(false);
                              setActionError("");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Edit<span className="sr-only"> {item.name}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
