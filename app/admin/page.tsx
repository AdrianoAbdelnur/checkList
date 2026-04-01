"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import { getPrimaryRole, hasAnyRole, normalizeRoles, ROLE_OPTIONS_ES, roleLabelEs } from "@/lib/roles";
import styles from "./page.module.css";

type User = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  telephone?: string;
  userNumber?: string;
  role: string;
  roles?: string[];
  isDelete?: boolean;
  createdAt?: string;
};

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  roles?: string[];
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  roles: string[];
  password: string;
};

const defaultForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  telephone: "",
  roles: ["inspector"],
  password: "",
};

function fullName(user: Partial<User> | null | undefined) {
  if (!user) return "-";
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email || "Sin nombre";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function AdminPage() {
  const router = useRouter();
  const lastAutoPasswordRef = React.useRef("");
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listLoading, setListLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<FormState>(defaultForm);

  const resetForm = React.useCallback(() => {
    setMode("create");
    setEditingId(null);
    setForm(defaultForm);
  }, []);

  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const fetchUsers = React.useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/users", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al cargar usuarios");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e: any) {
      setError(e.message || "Error al cargar usuarios");
    } finally {
      setListLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.user) {
          router.push("/login");
          return;
        }
        if (!hasAnyRole(data.user as any, ["admin"])) {
          router.push("/dashboard");
          return;
        }
        if (cancelled) return;
        setMe(data.user);
        await fetchUsers();
      } catch {
        router.push("/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [fetchUsers, router]);

  React.useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, closeModal]);

  React.useEffect(() => {
    if (mode !== "create") {
      lastAutoPasswordRef.current = "";
      return;
    }
    const lastName = form.lastName.trim();
    const nextDefault = `${lastName || ""}123`;
    if (!form.password || form.password === lastAutoPasswordRef.current) {
      patchForm("password", nextDefault);
      lastAutoPasswordRef.current = nextDefault;
    }
  }, [mode, form.lastName, form.password]);

  function patchForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startCreate() {
    setSuccess(null);
    setError(null);
    resetForm();
    setIsModalOpen(true);
  }

  function startEdit(user: User) {
    setSuccess(null);
    setError(null);
    setMode("edit");
    setEditingId(user._id);
    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      telephone: user.telephone || "",
      roles: normalizeRoles({ role: user.role, roles: user.roles }),
      password: "",
    });
    setIsModalOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      telephone: form.telephone,
      roles: form.roles,
      role: getPrimaryRole({ roles: form.roles }),
    };

    if (mode === "create") payload.password = form.password;
    else if (form.password.trim()) payload.password = form.password;

    try {
      const endpoint = mode === "create" ? "/api/auth/users" : `/api/auth/users/${editingId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");

      setSuccess(mode === "create" ? "Usuario creado" : "Usuario actualizado");
      await fetchUsers();
      closeModal();
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/auth/users/${deleteTarget._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar");
      setSuccess("Usuario eliminado");
      await fetchUsers();
      if (editingId === deleteTarget._id) closeModal();
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.message || "Error al eliminar");
    }
  }

  const filteredUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...users]
      .filter((u) => {
        if (roleFilter === "all") return true;
        const roles = normalizeRoles({ role: u.role, roles: u.roles });
        return roles.includes(roleFilter as any);
      })
      .filter((u) => {
        if (!q) return true;
        const rolesText = normalizeRoles({ role: u.role, roles: u.roles }).join(" ");
        const haystack = [fullName(u), u.email, u.telephone || "", u.userNumber || "", u.role || "", rolesText]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const an = fullName(a).toLowerCase();
        const bn = fullName(b).toLowerCase();
        return an.localeCompare(bn) || a.email.localeCompare(b.email);
      });
  }, [users, search, roleFilter]);

  if (loading) {
    return (
      <ThemeShell>
        <div className={styles.loading}>Cargando panel admin...</div>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={me}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Administración</p>
            <h1>Usuarios</h1>
            <p className={styles.subtitle}>
              Crear, editar y desactivar usuarios del sistema desde un solo panel.
            </p>
          </div>
          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={fetchUsers}
              disabled={listLoading}
            >
              {listLoading ? "Actualizando..." : "Actualizar lista"}
            </button>
            <button type="button" className={styles.primaryBtn} onClick={startCreate}>
              Nuevo usuario
            </button>
          </div>
        </section>

        {(error || success) && (
          <section className={styles.messages}>
            {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
            {success ? <div className={`${styles.message} ${styles.success}`}>{success}</div> : null}
          </section>
        )}

        <section className={styles.grid}>
          <div className={styles.listCard}>
            <div className={styles.cardHeader}>
              <h2>Usuarios registrados</h2>
              <span>
                {filteredUsers.length} / {users.length} activos
              </span>
            </div>

            <div className={styles.filters}>
              <label className={styles.filterField}>
                <span>Buscar</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, email, teléfono..."
                />
              </label>
              <label className={styles.filterField}>
                <span>Rol</span>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">Todos</option>
                  {ROLE_OPTIONS_ES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Alta</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyCell}>
                        No hay usuarios para ese filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u._id} className={editingId === u._id ? styles.activeRow : ""}>
                        <td>
                          <div className={styles.userCell}>
                            <div className={styles.avatar}>{fullName(u).slice(0, 1).toUpperCase()}</div>
                            <div>
                              <strong>{fullName(u)}</strong>
                              <small>{u.telephone || "Sin teléfono"}</small>
                              {u.userNumber ? <small>User Number: {u.userNumber}</small> : null}
                            </div>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {normalizeRoles({ role: u.role, roles: u.roles }).map((r) => (
                              <span key={`${u._id}-${r}`} className={`${styles.roleBadge} ${styles[`role_${r}`] || ""}`}>
                                {roleLabelEs(r)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{formatDate(u.createdAt)}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button type="button" className={styles.rowBtn} onClick={() => startEdit(u)}>
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`${styles.rowBtn} ${styles.danger}`}
                              onClick={() => setDeleteTarget(u)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {isModalOpen ? (
          <div className={styles.modalOverlay} onClick={closeModal} role="presentation">
            <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-user-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.cardHeader}>
                <h2 id="admin-user-modal-title">
                  {mode === "create" ? "Crear usuario" : "Editar usuario"}
                </h2>
                <div className={styles.modalHeaderActions}>
                  {mode === "edit" ? (
                    <button type="button" className={styles.linkBtn} onClick={startCreate}>
                      Cambiar a crear
                    </button>
                  ) : (
                    <span>Alta manual</span>
                  )}
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={closeModal}
                    aria-label="Cerrar modal"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <form onSubmit={submitForm} className={styles.form}>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>Nombre</span>
                    <input value={form.firstName} onChange={(e) => patchForm("firstName", e.target.value)} />
                  </label>

                  <label className={styles.field}>
                    <span>Apellido</span>
                    <input value={form.lastName} onChange={(e) => patchForm("lastName", e.target.value)} />
                  </label>
                </div>

                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>Email</span>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => patchForm("email", e.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Teléfono</span>
                    <input value={form.telephone} onChange={(e) => patchForm("telephone", e.target.value)} />
                  </label>
                </div>

                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <span>Roles</span>
                    <div className={styles.rolesGrid}>
                      {ROLE_OPTIONS_ES.map((r) => {
                        const checked = form.roles.includes(r.value);
                        return (
                          <label key={r.value} className={styles.roleOption}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...form.roles, r.value]
                                  : form.roles.filter((x) => x !== r.value);
                                patchForm("roles", next.length ? next : ["inspector"]);
                              }}
                            />
                            <span className={styles.roleOptionLabel}>{r.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <label className={styles.field}>
                  <span>{mode === "create" ? "Contraseña" : "Nueva contraseña (opcional)"}</span>
                  <input
                    type="text"
                    required={mode === "create"}
                    value={form.password}
                    onChange={(e) => patchForm("password", e.target.value)}
                  />
                </label>

                <div className={styles.formActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={closeModal}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.primaryBtn} disabled={saving}>
                    {saving ? "Guardando..." : mode === "create" ? "Crear usuario" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {deleteTarget ? (
          <div className={styles.modalOverlay} onClick={() => setDeleteTarget(null)} role="presentation">
            <div
              className={styles.confirmModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmIcon} aria-hidden>
                !
              </div>
              <h3 id="delete-user-title">Confirmar eliminación</h3>
              <p>
                Vas a desactivar al usuario <strong>{fullName(deleteTarget)}</strong>.
                Esta acción lo oculta del listado activo.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.deleteBtn}`}
                  onClick={confirmDeleteUser}
                >
                  Confirmar eliminación
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ThemeShell>
  );
}














