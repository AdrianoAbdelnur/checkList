"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import { hasPermission, normalizeRoles, roleLabelEs } from "@/lib/roles";
import styles from "./page.module.css";

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  roles?: string[];
};

type Inspector = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  userNumber?: string;
  role: string;
  roles?: string[];
  assignedTemplateIds?: string[];
};

type TemplateItem = {
  templateId: string;
  title: string;
  shortTitle?: string;
  version: number;
  isActive: boolean;
};

function displayName(u: Partial<Inspector> | null | undefined) {
  if (!u) return "-";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email || "-";
}

function normalizeIds(input?: string[]) {
  return Array.from(new Set((Array.isArray(input) ? input : []).map((x) => String(x).trim()).filter(Boolean))).sort();
}

function equalIdLists(a?: string[], b?: string[]) {
  const aa = normalizeIds(a);
  const bb = normalizeIds(b);
  if (aa.length !== bb.length) return false;
  return aa.every((x, idx) => x === bb[idx]);
}

function buildAssignmentMap(list: Inspector[]) {
  const map: Record<string, string[]> = {};
  for (const inspector of list) {
    map[inspector._id] = normalizeIds(inspector.assignedTemplateIds);
  }
  return map;
}

export default function InspectorAssignmentsPage() {
  const router = useRouter();
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<TemplateItem[]>([]);
  const [inspectors, setInspectors] = React.useState<Inspector[]>([]);
  const [inspectorFilter, setInspectorFilter] = React.useState("");
  const [baselineAssignments, setBaselineAssignments] = React.useState<Record<string, string[]>>({});
  const [savingAll, setSavingAll] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/inspector-templates", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al cargar matriz");
    const nextInspectors = Array.isArray(data.inspectors) ? data.inspectors : [];
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
    setInspectors(nextInspectors);
    setBaselineAssignments(buildAssignmentMap(nextInspectors));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        const meData = await meRes.json().catch(() => ({}));
        if (!meRes.ok || !meData?.user) {
          router.push("/login");
          return;
        }
        if (!hasPermission(meData.user as any, "user.manage")) {
          router.push("/dashboard");
          return;
        }

        if (cancelled) return;
        setMe(meData.user);
        await loadData();
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadData, router]);

  const changedInspectorIds = React.useMemo(() => {
    return inspectors
      .filter((inspector) => !equalIdLists(inspector.assignedTemplateIds, baselineAssignments[inspector._id] || []))
      .map((inspector) => inspector._id);
  }, [inspectors, baselineAssignments]);

  const hasPendingChanges = changedInspectorIds.length > 0;

  const visibleInspectors = React.useMemo(() => {
    const q = inspectorFilter.trim().toLowerCase();
    if (!q) return inspectors;

    return inspectors.filter((inspector) => {
      const haystack = [
        displayName(inspector),
        inspector.email,
        inspector.userNumber || "",
        normalizeRoles(inspector).map(roleLabelEs).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [inspectorFilter, inspectors]);

  function toggleAssignment(userId: string, templateId: string, checked: boolean) {
    setError(null);
    setSuccess(null);

    setInspectors((prev) =>
      prev.map((inspector) => {
        if (inspector._id !== userId) return inspector;
        const current = Array.isArray(inspector.assignedTemplateIds) ? inspector.assignedTemplateIds : [];
        const updated = checked
          ? Array.from(new Set([...current, templateId]))
          : current.filter((id) => id !== templateId);
        return { ...inspector, assignedTemplateIds: updated };
      }),
    );
  }

  function toggleAllAssignmentsForInspector(userId: string, checked: boolean) {
    setError(null);
    setSuccess(null);

    const allTemplateIds = templates.map((t) => t.templateId);
    setInspectors((prev) =>
      prev.map((inspector) => {
        if (inspector._id !== userId) return inspector;
        return { ...inspector, assignedTemplateIds: checked ? allTemplateIds : [] };
      }),
    );
  }

  async function saveChanges() {
    if (!hasPendingChanges || savingAll) return;

    setSavingAll(true);
    setError(null);
    setSuccess(null);

    let saved = 0;
    const errors: string[] = [];

    for (const inspector of inspectors) {
      if (!changedInspectorIds.includes(inspector._id)) continue;
      try {
        const res = await fetch("/api/admin/inspector-templates", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: inspector._id,
            templateIds: normalizeIds(inspector.assignedTemplateIds),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudo guardar");
        saved += 1;
      } catch (e: any) {
        errors.push(`${displayName(inspector)}: ${e.message || "error"}`);
      }
    }

    if (errors.length > 0) {
      setError(`No se pudieron guardar ${errors.length} cambios. ${errors[0]}`);
      await loadData();
    } else {
      setBaselineAssignments(buildAssignmentMap(inspectors));
      setSuccess(`Asignaciones guardadas (${saved} inspector/es).`);
    }

    setSavingAll(false);
  }

  if (loading) {
    return (
      <ThemeShell user={me}>
        <main className={styles.page}>
          <div className={styles.loading}>Cargando administración de inspectores...</div>
        </main>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={me}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Administración</p>
            <h1>Inspectores y checklists asignados</h1>
            <p className={styles.subtitle}>
              Matriz de asignación: inspectores a la izquierda y todos los checklists del sistema arriba.
            </p>
          </div>
          <div className={styles.heroActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => void loadData()}>
              Actualizar
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!hasPendingChanges || savingAll}
              onClick={() => void saveChanges()}
            >
              {savingAll ? "Guardando..." : `Guardar cambios${hasPendingChanges ? ` (${changedInspectorIds.length})` : ""}`}
            </button>
            <a href="/dashboard" className={styles.secondaryBtn}>
              Volver al panel
            </a>
          </div>
        </section>

        {(error || success) && (
          <section className={styles.messages}>
            {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
            {success ? <div className={`${styles.message} ${styles.success}`}>{success}</div> : null}
          </section>
        )}

        <section className={styles.matrixWrap}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th className={styles.stickyCol}>
                  <div className={styles.inspectorHead}>
                    <strong>Inspector</strong>
                    <input
                      type="search"
                      placeholder="Buscar inspector..."
                      value={inspectorFilter}
                      onChange={(e) => setInspectorFilter(e.target.value)}
                    />
                  </div>
                </th>
                <th className={styles.allHeadCol}>Todos</th>
                {templates.map((t) => (
                  <th
                    key={t.templateId}
                    title={`${t.title || t.shortTitle || t.templateId} (${t.templateId}) v${t.version}`}
                  >
                    <div className={styles.colHead}>
                      <strong>{t.shortTitle || t.title || t.templateId}</strong>
                      <small>{t.templateId}</small>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleInspectors.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={Math.max(3, templates.length + 2)}>
                    No hay inspectores para ese filtro.
                  </td>
                </tr>
              ) : (
                visibleInspectors.map((inspector) => {
                  const assigned = new Set(inspector.assignedTemplateIds || []);
                  const changed = changedInspectorIds.includes(inspector._id);

                  return (
                    <tr key={inspector._id} className={changed ? styles.changedRow : ""}>
                      <td className={styles.stickyCol}>
                        <div className={styles.userCell}>
                          <strong>{displayName(inspector)}</strong>
                          {inspector.userNumber ? <small>User Number: {inspector.userNumber}</small> : null}
                          <small>{inspector.email}</small>
                          <small>{normalizeRoles(inspector).map(roleLabelEs).join(" | ")}</small>
                        </div>
                      </td>
                      <td className={styles.centerCell}>
                        <input
                          type="checkbox"
                          checked={templates.length > 0 && templates.every((t) => assigned.has(t.templateId))}
                          disabled={savingAll || templates.length === 0}
                          onChange={(e) => toggleAllAssignmentsForInspector(inspector._id, e.target.checked)}
                        />
                      </td>

                      {templates.map((t) => {
                        const checked = assigned.has(t.templateId);
                        return (
                          <td key={t.templateId} className={styles.centerCell}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={savingAll}
                              onChange={(e) => toggleAssignment(inspector._id, t.templateId, e.target.checked)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </main>
    </ThemeShell>
  );
}

