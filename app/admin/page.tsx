"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import { getPrimaryRole, hasAnyRole, isSuperAdmin, normalizeRoles, ROLE_OPTIONS_ES, roleLabelEs } from "@/lib/roles";
import styles from "./page.module.css";

type User = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  telephone?: string;
  userNumber?: string;
  tenantId?: string;
  role: string;
  roles?: string[];
  isDelete?: boolean;
  createdAt?: string;
};

type Tenant = {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  isDelete?: boolean;
  createdAt?: string;
  usersCount?: number;
};

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  roles?: string[];
  tenantId?: string;
};

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  roles: string[];
  password: string;
  tenantId: string;
};

type TenantFormState = {
  name: string;
  code: string;
  isActive: boolean;
};

type FieldErrors = Partial<Record<keyof UserFormState, string>>;
type TenantFieldErrors = Partial<Record<keyof TenantFormState, string>>;

const defaultUserForm: UserFormState = {
  firstName: "",
  lastName: "",
  email: "",
  telephone: "",
  roles: ["inspector"],
  password: "",
  tenantId: "",
};

const defaultTenantForm: TenantFormState = {
  name: "",
  code: "",
  isActive: true,
};

const MANAGEABLE_ROLE_OPTIONS = ROLE_OPTIONS_ES.filter((role) => role.value !== "superAdmin");

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

function toTenantCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export default function AdminPage() {
  const router = useRouter();
  const lastAutoPasswordRef = React.useRef("");
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listLoading, setListLoading] = React.useState(false);
  const [tenantsLoading, setTenantsLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [tenantSaving, setTenantSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [userModalError, setUserModalError] = React.useState<string | null>(null);
  const [tenantModalError, setTenantModalError] = React.useState<string | null>(null);
  const [userFieldErrors, setUserFieldErrors] = React.useState<FieldErrors>({});
  const [tenantFieldErrors, setTenantFieldErrors] = React.useState<TenantFieldErrors>({});
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [tenantFilter, setTenantFilter] = React.useState("all");
  const [activeTab, setActiveTab] = React.useState<"users" | "tenants">("users");
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingUserTenantId, setEditingUserTenantId] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<UserFormState>(defaultUserForm);
  const [tenantMode, setTenantMode] = React.useState<"create" | "edit">("create");
  const [editingTenantId, setEditingTenantId] = React.useState<string | null>(null);
  const [isTenantModalOpen, setIsTenantModalOpen] = React.useState(false);
  const [deactivateTenantTarget, setDeactivateTenantTarget] = React.useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = React.useState<TenantFormState>(defaultTenantForm);
  const [tenantCodeTouched, setTenantCodeTouched] = React.useState(false);

  const currentUserIsSuperAdmin = isSuperAdmin(me);

  const activeTenants = React.useMemo(
    () => tenants.filter((tenant) => tenant.isDelete !== true && tenant.isActive),
    [tenants],
  );

  const tenantsByCode = React.useMemo(() => {
    const next = new Map<string, Tenant>();
    for (const tenant of tenants) next.set(tenant.code, tenant);
    return next;
  }, [tenants]);

  const assignableTenants = React.useMemo(() => {
    if (!currentUserIsSuperAdmin) return activeTenants;
    if (!editingUserTenantId) return activeTenants;
    const current = tenantsByCode.get(editingUserTenantId);
    if (!current || current.isActive) return activeTenants;
    return [...activeTenants, current];
  }, [activeTenants, currentUserIsSuperAdmin, editingUserTenantId, tenantsByCode]);

  const resetForm = React.useCallback(() => {
    setMode("create");
    setEditingId(null);
    setEditingUserTenantId(null);
    setForm({
      ...defaultUserForm,
      tenantId: currentUserIsSuperAdmin ? "" : String(me?.tenantId || "general").trim() || "general",
    });
  }, [currentUserIsSuperAdmin, me?.tenantId]);

  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
    setUserModalError(null);
    setUserFieldErrors({});
    resetForm();
  }, [resetForm]);

  const resetTenantForm = React.useCallback(() => {
    setTenantMode("create");
    setEditingTenantId(null);
    setTenantCodeTouched(false);
    setTenantForm(defaultTenantForm);
  }, []);

  const closeTenantModal = React.useCallback(() => {
    setIsTenantModalOpen(false);
    setTenantModalError(null);
    setTenantFieldErrors({});
    resetTenantForm();
  }, [resetTenantForm]);

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

  const fetchTenants = React.useCallback(async () => {
    setTenantsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tenants", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al cargar tenants");
      setTenants(Array.isArray(data.tenants) ? data.tenants : []);
    } catch (e: any) {
      setError(e.message || "Error al cargar tenants");
    } finally {
      setTenantsLoading(false);
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

        const tasks = [fetchUsers()];
        if (isSuperAdmin(data.user as any)) tasks.push(fetchTenants());
        await Promise.all(tasks);
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
  }, [fetchTenants, fetchUsers, router]);

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

  React.useEffect(() => {
    if (tenantMode !== "create" || tenantCodeTouched) return;
    setTenantForm((prev) => ({ ...prev, code: toTenantCode(prev.name) || "tenant" }));
  }, [tenantMode, tenantCodeTouched, tenantForm.name]);

  function patchForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setUserFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function patchTenantForm<K extends keyof TenantFormState>(key: K, value: TenantFormState[K]) {
    setTenantFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTenantForm((prev) => ({ ...prev, [key]: value }));
  }

  function resolveTenantName(code?: string | null) {
    const normalized = String(code || "").trim() || "general";
    const tenant = tenantsByCode.get(normalized);
    if (!tenant) return normalized;
    return tenant.name;
  }

  function startCreate() {
    setSuccess(null);
    setError(null);
    setUserModalError(null);
    setUserFieldErrors({});
    resetForm();
    setIsModalOpen(true);
  }

  function startEdit(user: User) {
    setSuccess(null);
    setError(null);
    setUserModalError(null);
    setUserFieldErrors({});
    setMode("edit");
    setEditingId(user._id);
    setEditingUserTenantId(String(user.tenantId || "general").trim() || "general");
    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      telephone: user.telephone || "",
      roles: normalizeRoles({ role: user.role, roles: user.roles }),
      password: "",
      tenantId: String(user.tenantId || "general").trim() || "general",
    });
    setIsModalOpen(true);
  }

  function startTenantCreate() {
    setSuccess(null);
    setError(null);
    setTenantModalError(null);
    setTenantFieldErrors({});
    resetTenantForm();
    setIsTenantModalOpen(true);
  }

  function startTenantEdit(tenant: Tenant) {
    setSuccess(null);
    setError(null);
    setTenantModalError(null);
    setTenantFieldErrors({});
    setTenantMode("edit");
    setEditingTenantId(tenant._id);
    setTenantCodeTouched(true);
    setTenantForm({
      name: tenant.name,
      code: tenant.code,
      isActive: tenant.isActive,
    });
    setIsTenantModalOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setUserModalError(null);
    setUserFieldErrors({});
    setSuccess(null);

    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      telephone: form.telephone,
      roles: form.roles,
      role: getPrimaryRole({ roles: form.roles }),
    };

    const effectiveTenantId = currentUserIsSuperAdmin
      ? String(form.tenantId || "").trim()
      : String(me?.tenantId || "general").trim() || "general";

    const nextFieldErrors: FieldErrors = {};
    if (!String(form.email || "").trim()) nextFieldErrors.email = "Debes ingresar un email";
    if (mode === "create" && !String(form.password || "").trim()) {
      nextFieldErrors.password = "Debes ingresar una contraseña";
    }
    if (currentUserIsSuperAdmin && !effectiveTenantId) {
      nextFieldErrors.tenantId = "Debes seleccionar un tenant";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setUserFieldErrors(nextFieldErrors);
      setSaving(false);
      return;
    }

    if (mode === "create") {
      payload.password = form.password;
      payload.tenantId = effectiveTenantId;
    } else {
      if (form.password.trim()) payload.password = form.password;
      if (currentUserIsSuperAdmin && effectiveTenantId !== String(editingUserTenantId || "")) {
        payload.tenantId = effectiveTenantId;
      }
    }

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
      setUserModalError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function submitTenantForm(e: React.FormEvent) {
    e.preventDefault();
    setTenantSaving(true);
    setTenantModalError(null);
    setTenantFieldErrors({});
    setSuccess(null);

    const payload: Record<string, unknown> = {
      name: tenantForm.name.trim(),
    };

    const nextTenantFieldErrors: TenantFieldErrors = {};
    if (!String(tenantForm.name || "").trim()) nextTenantFieldErrors.name = "Debes ingresar un nombre";
    if (tenantMode === "create" && !String(tenantForm.code || "").trim()) {
      nextTenantFieldErrors.code = "Debes ingresar un código";
    }
    if (Object.keys(nextTenantFieldErrors).length > 0) {
      setTenantFieldErrors(nextTenantFieldErrors);
      setTenantSaving(false);
      return;
    }

    if (tenantMode === "create") {
      payload.code = toTenantCode(tenantForm.code);
    } else {
      payload.isActive = tenantForm.isActive;
    }

    try {
      const endpoint = tenantMode === "create" ? "/api/admin/tenants" : `/api/admin/tenants/${editingTenantId}`;
      const method = tenantMode === "create" ? "POST" : "PATCH";
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el tenant");

      setSuccess(tenantMode === "create" ? "Tenant creado" : "Tenant actualizado");
      await Promise.all([fetchTenants(), fetchUsers()]);
      closeTenantModal();
    } catch (e: any) {
      setTenantModalError(e.message || "Error al guardar tenant");
    } finally {
      setTenantSaving(false);
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

  async function confirmDeactivateTenant() {
    if (!deactivateTenantTarget) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/tenants/${deactivateTenantTarget._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo desactivar el tenant");
      setSuccess("Tenant desactivado");
      await Promise.all([fetchTenants(), fetchUsers()]);
      setDeactivateTenantTarget(null);
    } catch (e: any) {
      setError(e.message || "Error al desactivar tenant");
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
        if (!currentUserIsSuperAdmin || tenantFilter === "all") return true;
        return (String(u.tenantId || "general").trim() || "general") === tenantFilter;
      })
      .filter((u) => {
        if (!q) return true;
        const rolesText = normalizeRoles({ role: u.role, roles: u.roles }).join(" ");
        const tenantText = resolveTenantName(u.tenantId);
        const haystack = [fullName(u), u.email, u.telephone || "", u.userNumber || "", u.role || "", rolesText, tenantText]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const an = fullName(a).toLowerCase();
        const bn = fullName(b).toLowerCase();
        return an.localeCompare(bn) || a.email.localeCompare(b.email);
      });
  }, [currentUserIsSuperAdmin, roleFilter, search, tenantFilter, users]);

  const filteredTenants = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...tenants]
      .filter((tenant) => tenant.isDelete !== true)
      .filter((tenant) => {
        if (!q) return true;
        return [tenant.name, tenant.code, tenant.isActive ? "activo" : "inactivo"].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  }, [search, tenants]);

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
            <p className={styles.kicker}>Administracion</p>
            <h1>{activeTab === "users" ? "Usuarios" : "Tenants"}</h1>
            <p className={styles.subtitle}>
              {activeTab === "users"
                ? "Crear, editar y desactivar usuarios del sistema desde un solo panel."
                : "Gestiona tenants, su estado y el alcance operativo de nuevas altas."}
            </p>
            {currentUserIsSuperAdmin ? (
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === "users" ? styles.tabBtnActive : ""}`}
                  onClick={() => {
                    setActiveTab("users");
                    setSearch("");
                  }}
                >
                  Usuarios
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === "tenants" ? styles.tabBtnActive : ""}`}
                  onClick={() => {
                    setActiveTab("tenants");
                    setSearch("");
                  }}
                >
                  Tenants
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.heroActions}>
            {activeTab === "users" ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={fetchTenants}
                  disabled={tenantsLoading}
                >
                  {tenantsLoading ? "Actualizando..." : "Actualizar lista"}
                </button>
                <button type="button" className={styles.primaryBtn} onClick={startTenantCreate}>
                  Nuevo tenant
                </button>
              </>
            )}
          </div>
        </section>

        {(error || success) && (
          <section className={styles.messages}>
            {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
            {success ? <div className={`${styles.message} ${styles.success}`}>{success}</div> : null}
          </section>
        )}

        {activeTab === "users" ? (
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
                    placeholder="Nombre, email, telefono..."
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
                {currentUserIsSuperAdmin ? (
                  <label className={styles.filterField}>
                    <span>Tenant</span>
                    <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
                      <option value="all">Todos</option>
                      {tenants.map((tenant) => (
                        <option key={tenant._id} value={tenant.code}>
                          {tenant.name} ({tenant.code})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Email</th>
                      <th>Rol</th>
                      {currentUserIsSuperAdmin ? <th>Tenant</th> : null}
                      <th>Alta</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={currentUserIsSuperAdmin ? 6 : 5} className={styles.emptyCell}>
                          No hay usuarios para ese filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const tenantCode = String(u.tenantId || "general").trim() || "general";
                        const tenant = tenantsByCode.get(tenantCode);
                        return (
                          <tr key={u._id} className={editingId === u._id ? styles.activeRow : ""}>
                            <td>
                              <div className={styles.userCell}>
                                <div className={styles.avatar}>{fullName(u).slice(0, 1).toUpperCase()}</div>
                                <div>
                                  <strong>{fullName(u)}</strong>
                                  <small>{u.telephone || "Sin telefono"}</small>
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
                            {currentUserIsSuperAdmin ? (
                              <td>
                                <div className={styles.tenantCell}>
                                  <strong>{tenant?.name || tenantCode}</strong>
                                  <small>{tenantCode}</small>
                                  {tenant ? (
                                    <span className={`${styles.stateBadge} ${tenant.isActive ? styles.stateActive : styles.stateInactive}`}>
                                      {tenant.isActive ? "Activo" : "Inactivo"}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            ) : null}
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.grid}>
            <div className={styles.listCard}>
              <div className={styles.cardHeader}>
                <h2>Tenants registrados</h2>
                <span>{filteredTenants.length} tenants</span>
              </div>

              <div className={styles.filters}>
                <label className={styles.filterField}>
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nombre o codigo..."
                  />
                </label>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Codigo</th>
                      <th>Estado</th>
                      <th>Usuarios</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyCell}>
                          No hay tenants para ese filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((tenant) => (
                        <tr key={tenant._id} className={editingTenantId === tenant._id ? styles.activeRow : ""}>
                          <td>
                            <div className={styles.tenantCell}>
                              <strong>{tenant.name}</strong>
                              <small>Creado: {formatDate(tenant.createdAt)}</small>
                            </div>
                          </td>
                          <td>{tenant.code}</td>
                          <td>
                            <span className={`${styles.stateBadge} ${tenant.isActive ? styles.stateActive : styles.stateInactive}`}>
                              {tenant.isActive ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>{tenant.usersCount || 0}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <button type="button" className={styles.rowBtn} onClick={() => startTenantEdit(tenant)}>
                                Editar
                              </button>
                              {tenant.isActive && tenant.code !== "general" ? (
                                <button
                                  type="button"
                                  className={`${styles.rowBtn} ${styles.danger}`}
                                  onClick={() => setDeactivateTenantTarget(tenant)}
                                >
                                  Desactivar
                                </button>
                              ) : null}
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
        )}

        {isModalOpen ? (
          <div className={styles.modalOverlay} role="presentation">
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
                {userModalError ? (
                  <div className={`${styles.message} ${styles.error}`}>{userModalError}</div>
                ) : null}
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>Nombre</span>
                    <input
                      value={form.firstName}
                      onChange={(e) => patchForm("firstName", e.target.value)}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Apellido</span>
                    <input
                      value={form.lastName}
                      onChange={(e) => patchForm("lastName", e.target.value)}
                    />
                  </label>
                </div>

                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>Email</span>
                    <input
                      type="email"
                      className={userFieldErrors.email ? styles.fieldErrorControl : undefined}
                      value={form.email}
                      onChange={(e) => patchForm("email", e.target.value)}
                    />
                    {userFieldErrors.email ? (
                      <small className={styles.fieldErrorText}>{userFieldErrors.email}</small>
                    ) : null}
                  </label>

                  <label className={styles.field}>
                    <span>Telefono</span>
                    <input value={form.telephone} onChange={(e) => patchForm("telephone", e.target.value)} />
                  </label>
                </div>

                {currentUserIsSuperAdmin ? (
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Tenant</span>
                      <select
                        value={form.tenantId}
                        className={userFieldErrors.tenantId ? styles.fieldErrorControl : undefined}
                        onChange={(e) => patchForm("tenantId", e.target.value)}
                      >
                        <option value="">Seleccionar tenant</option>
                        {assignableTenants.map((tenant) => (
                          <option key={tenant._id} value={tenant.code}>
                            {tenant.name} ({tenant.code}){tenant.isActive ? "" : " - inactivo"}
                          </option>
                        ))}
                      </select>
                      {userFieldErrors.tenantId ? (
                        <small className={styles.fieldErrorText}>{userFieldErrors.tenantId}</small>
                      ) : null}
                    </label>
                  </div>
                ) : null}

                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <span>Roles</span>
                    <div className={styles.rolesGrid}>
                      {MANAGEABLE_ROLE_OPTIONS.map((r) => {
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
                    className={userFieldErrors.password ? styles.fieldErrorControl : undefined}
                    value={form.password}
                    onChange={(e) => patchForm("password", e.target.value)}
                  />
                  {userFieldErrors.password ? (
                    <small className={styles.fieldErrorText}>{userFieldErrors.password}</small>
                  ) : null}
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

        {isTenantModalOpen ? (
          <div className={styles.modalOverlay} role="presentation">
            <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-tenant-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.cardHeader}>
                <h2 id="admin-tenant-modal-title">
                  {tenantMode === "create" ? "Crear tenant" : "Editar tenant"}
                </h2>
                <div className={styles.modalHeaderActions}>
                  {tenantMode === "edit" ? (
                    <button type="button" className={styles.linkBtn} onClick={startTenantCreate}>
                      Cambiar a crear
                    </button>
                  ) : (
                    <span>Alta manual</span>
                  )}
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={closeTenantModal}
                    aria-label="Cerrar modal"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <form onSubmit={submitTenantForm} className={styles.form}>
                {tenantModalError ? (
                  <div className={`${styles.message} ${styles.error}`}>{tenantModalError}</div>
                ) : null}
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>Nombre</span>
                    <input
                      className={tenantFieldErrors.name ? styles.fieldErrorControl : undefined}
                      value={tenantForm.name}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        setTenantForm((prev) => ({
                          ...prev,
                          name: nextName,
                          code: tenantMode === "create" && !tenantCodeTouched ? toTenantCode(nextName) || "tenant" : prev.code,
                        }));
                      }}
                    />
                    {tenantFieldErrors.name ? (
                      <small className={styles.fieldErrorText}>{tenantFieldErrors.name}</small>
                    ) : null}
                  </label>

                  <label className={styles.field}>
                    <span>Codigo</span>
                    <input
                      className={tenantFieldErrors.code ? styles.fieldErrorControl : undefined}
                      value={tenantForm.code}
                      disabled={tenantMode !== "create"}
                      onChange={(e) => {
                        setTenantCodeTouched(true);
                        patchTenantForm("code", toTenantCode(e.target.value));
                      }}
                    />
                    {tenantFieldErrors.code ? (
                      <small className={styles.fieldErrorText}>{tenantFieldErrors.code}</small>
                    ) : null}
                  </label>
                </div>

                {tenantMode === "edit" ? (
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Estado</span>
                      <select
                        value={tenantForm.isActive ? "active" : "inactive"}
                        disabled={tenantForm.code === "general"}
                        onChange={(e) => patchTenantForm("isActive", e.target.value === "active")}
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                <div className={styles.formActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={closeTenantModal}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.primaryBtn} disabled={tenantSaving}>
                    {tenantSaving ? "Guardando..." : tenantMode === "create" ? "Crear tenant" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {deleteTarget ? (
          <div className={styles.modalOverlay} role="presentation">
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

        {deactivateTenantTarget ? (
          <div className={styles.modalOverlay} role="presentation">
            <div
              className={styles.confirmModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="deactivate-tenant-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmIcon} aria-hidden>
                !
              </div>
              <h3 id="deactivate-tenant-title">Confirmar desactivación</h3>
              <p>
                Vas a desactivar el tenant <strong>{deactivateTenantTarget.name}</strong> ({deactivateTenantTarget.code}).
              </p>
              {(deactivateTenantTarget.usersCount || 0) > 0 ? (
                <p>
                  Este tenant tiene <strong>{deactivateTenantTarget.usersCount}</strong> usuarios activos.
                  No se podrán asignar nuevos usuarios a este tenant hasta reactivarlo.
                </p>
              ) : null}
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setDeactivateTenantTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.deleteBtn}`}
                  onClick={confirmDeactivateTenant}
                >
                  Confirmar desactivación
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ThemeShell>
  );
}
