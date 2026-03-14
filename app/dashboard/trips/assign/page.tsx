"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import { hasAnyRole, hasPermission } from "@/lib/roles";
import styles from "./page.module.css";

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  roles?: string[];
};

type TripItem = {
  _id: string;
  dominio: string;
  tripDateKey: string;
  solicitudAt?: string | null;
  tipo?: string;
  assignedTemplateIds?: string[];
  assignedInspectorByTemplate?: Record<string, string>;
};

type TemplateItem = {
  templateId: string;
  title: string;
  shortTitle?: string;
  version: number;
};

type InspectorItem = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  inspectorNumber?: string;
  assignedTemplateIds?: string[];
};
type InspectorOption = {
  id: string;
  label: string;
  keywords: string;
};

function formatDateEsFromKey(key: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!m) return key || "-";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeIds(input?: string[]) {
  return Array.from(new Set((Array.isArray(input) ? input : []).map((x) => String(x).trim()).filter(Boolean))).sort();
}

function normalizeAssignmentMap(input?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const [templateIdRaw, inspectorIdRaw] of Object.entries(input)) {
    const templateId = String(templateIdRaw || "").trim();
    const inspectorId = String(inspectorIdRaw || "").trim();
    if (!templateId || !inspectorId) continue;
    out[templateId] = inspectorId;
  }
  return out;
}

function buildMap(items: TripItem[]) {
  const out: Record<string, Record<string, string>> = {};
  for (const it of items) out[it._id] = normalizeAssignmentMap(it.assignedInspectorByTemplate);
  return out;
}

function equalAssignmentMaps(a?: Record<string, string>, b?: Record<string, string>) {
  const aa = normalizeAssignmentMap(a);
  const bb = normalizeAssignmentMap(b);
  const keysA = Object.keys(aa).sort();
  const keysB = Object.keys(bb).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    const key = keysA[i];
    if (key !== keysB[i]) return false;
    if (aa[key] !== bb[key]) return false;
  }
  return true;
}

function inspectorName(inspector: InspectorItem) {
  const full = `${inspector.firstName || ""} ${inspector.lastName || ""}`.trim();
  if (inspector.inspectorNumber) {
    const suffix = full || inspector.email || inspector._id;
    return `N° ${inspector.inspectorNumber} - ${suffix}`;
  }
  return full || inspector.email || inspector._id;
}

function SearchableInspectorSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  allowClear = true,
}: {
  options: InspectorOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.keywords.includes(q));
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className={`${styles.searchableSelect} ${className || ""}`}>
      <button
        type="button"
        className={styles.searchableTrigger}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label || placeholder}</span>
      </button>
      {open ? (
        <div className={styles.searchablePanel}>
          <input
            ref={inputRef}
            className={styles.searchableInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar inspector..."
          />
          <div className={styles.searchableList} role="listbox">
            {allowClear ? (
              <button
                type="button"
                className={styles.searchableOption}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
              >
                Sin asignar
              </button>
            ) : null}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`${styles.searchableOption} ${value === o.id ? styles.searchableOptionActive : ""}`}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 ? <div className={styles.searchableEmpty}>Sin resultados</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AssignTripsPage() {
  const router = useRouter();
  const [assignMode, setAssignMode] = React.useState<"byChecklist" | "byInspector">("byChecklist");
  const [selectedInspectorId, setSelectedInspectorId] = React.useState("");
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [dateKey, setDateKey] = React.useState(formatTodayKey());
  const [trips, setTrips] = React.useState<TripItem[]>([]);
  const [templates, setTemplates] = React.useState<TemplateItem[]>([]);
  const [inspectors, setInspectors] = React.useState<InspectorItem[]>([]);
  const [baseline, setBaseline] = React.useState<Record<string, Record<string, string>>>({});
  const [savingAll, setSavingAll] = React.useState(false);

  const loadData = React.useCallback(async (targetDate: string) => {
    const res = await fetch(`/api/trips/assignments?date=${encodeURIComponent(targetDate)}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) throw new Error(data?.message || "No se pudo cargar matriz");

    const nextTrips = Array.isArray(data.trips) ? data.trips : [];
    setTrips(nextTrips);
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
    setInspectors(Array.isArray(data.inspectors) ? data.inspectors : []);
    setBaseline(buildMap(nextTrips));
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

        const allowed =
          hasPermission(data.user as any, "checklist.view_all") ||
          hasAnyRole(data.user as any, ["admin", "supervisor", "reviewer"]);
        if (!allowed) {
          router.push("/dashboard");
          return;
        }

        if (cancelled) return;
        setMe(data.user);
        await loadData(dateKey);
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
  }, [dateKey, loadData, router]);

  const changedTripIds = React.useMemo(() => {
    return trips
      .filter((t) => !equalAssignmentMaps(t.assignedInspectorByTemplate, baseline[t._id] || {}))
      .map((t) => t._id);
  }, [trips, baseline]);

  const hasPendingChanges = changedTripIds.length > 0;

  const inspectorsByTemplate = React.useMemo(() => {
    const map: Record<string, InspectorItem[]> = {};
    for (const template of templates) map[template.templateId] = [];
    for (const inspector of inspectors) {
      for (const templateId of normalizeIds(inspector.assignedTemplateIds)) {
        if (!map[templateId]) map[templateId] = [];
        map[templateId].push(inspector);
      }
    }
    return map;
  }, [inspectors, templates]);
  const inspectorOptions = React.useMemo<InspectorOption[]>(() => {
    return inspectors.map((inspector) => {
      const label = inspectorName(inspector);
      const keywords = [label, inspector.email || "", inspector.inspectorNumber || ""].join(" ").toLowerCase();
      return { id: inspector._id, label, keywords };
    });
  }, [inspectors]);
  const inspectorNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const inspector of inspectors) {
      map[inspector._id] = inspectorName(inspector);
    }
    return map;
  }, [inspectors]);

  React.useEffect(() => {
    if (assignMode !== "byInspector") return;
    if (selectedInspectorId && inspectors.some((i) => i._id === selectedInspectorId)) return;
    const assignedInspectorIds = trips
      .flatMap((trip) => Object.values(normalizeAssignmentMap(trip.assignedInspectorByTemplate)))
      .filter((id) => inspectors.some((inspector) => inspector._id === id));
    setSelectedInspectorId(assignedInspectorIds[0] || inspectors[0]?._id || "");
  }, [assignMode, inspectors, selectedInspectorId, trips]);

  function setTripTemplateInspector(tripId: string, templateId: string, inspectorId: string) {
    setError(null);
    setSuccess(null);
    setTrips((prev) =>
      prev.map((trip) => {
        if (trip._id !== tripId) return trip;
        const current = normalizeAssignmentMap(trip.assignedInspectorByTemplate);
        if (inspectorId) {
          current[templateId] = inspectorId;
        } else {
          delete current[templateId];
        }
        return {
          ...trip,
          assignedInspectorByTemplate: current,
          assignedTemplateIds: Object.keys(current),
        };
      }),
    );
  }

  function toggleTripTemplateForSelectedInspector(tripId: string, templateId: string, checked: boolean) {
    if (!selectedInspectorId) return;
    setError(null);
    setSuccess(null);
    setTrips((prev) =>
      prev.map((trip) => {
        if (trip._id !== tripId) return trip;
        const current = normalizeAssignmentMap(trip.assignedInspectorByTemplate);
        if (checked) {
          current[templateId] = selectedInspectorId;
        } else if (current[templateId] === selectedInspectorId) {
          delete current[templateId];
        }
        return {
          ...trip,
          assignedInspectorByTemplate: current,
          assignedTemplateIds: Object.keys(current),
        };
      }),
    );
  }

  async function saveAllChanges() {
    if (!hasPendingChanges || savingAll) return;

    setSavingAll(true);
    setError(null);
    setSuccess(null);

    let saved = 0;
    const errors: string[] = [];

    for (const trip of trips) {
      if (!changedTripIds.includes(trip._id)) continue;
      try {
        const res = await fetch("/api/trips/assignments", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId: trip._id,
            inspectorAssignments: normalizeAssignmentMap(trip.assignedInspectorByTemplate),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) throw new Error(data?.message || "No se pudo guardar");
        saved += 1;
      } catch (e: any) {
        errors.push(`Viaje ${trip.dominio}: ${e.message || "error"}`);
      }
    }

    if (errors.length > 0) {
      setError(`No se pudieron guardar ${errors.length} cambios. ${errors[0]}`);
      await loadData(dateKey);
    } else {
      setBaseline(buildMap(trips));
      setSuccess(`Asignaciones guardadas (${saved} viaje/s).`);
    }

    setSavingAll(false);
  }

  if (loading) {
    return (
      <ThemeShell user={me}>
        <main className={styles.page}>
          <div className={styles.loading}>Cargando asignaciones de viajes...</div>
        </main>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={me}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Planificación</p>
            <h1>Asignar viajes</h1>
            <p className={styles.subtitle}>
              Matriz de viajes del día vs checklists. Marcá qué checklist corresponde a cada viaje.
            </p>
          </div>
          <div className={styles.heroActions}>
            <div className={styles.heroMainActions}>
              <label className={styles.dateFilter}>
                <span>Fecha</span>
                <div className={styles.dateSelector}>
                  <input
                    type="text"
                    className={styles.dateDisplay}
                    value={formatDateEsFromKey(dateKey)}
                    readOnly
                    aria-label="Fecha seleccionada en formato español"
                  />
                  <label className={styles.datePickerBtn} aria-label="Abrir calendario">
                    <svg
                      aria-hidden
                      className={styles.dateIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <input
                      type="date"
                      className={styles.datePickerNative}
                      value={dateKey}
                      onChange={(e) => setDateKey(e.target.value)}
                      lang="es-AR"
                      aria-label="Selector de fecha"
                    />
                  </label>
                </div>
              </label>
              <button type="button" className={styles.primaryBtn} disabled={!hasPendingChanges || savingAll} onClick={() => void saveAllChanges()}>
                {savingAll ? "Guardando..." : `Guardar cambios${hasPendingChanges ? ` (${changedTripIds.length})` : ""}`}
              </button>
              <a href="/dashboard/trips" className={styles.secondaryBtn}>Volver</a>
            </div>
            <div className={styles.heroModeActions}>
              <label className={styles.modeFilter}>
                <span>Modo</span>
                <select value={assignMode} onChange={(e) => setAssignMode(e.target.value as "byChecklist" | "byInspector")}>
                  <option value="byChecklist">Por checklist</option>
                  <option value="byInspector">Por inspector</option>
                </select>
              </label>
              {assignMode === "byInspector" ? (
                <label className={styles.modeFilter}>
                  <span>Inspector</span>
                  <SearchableInspectorSelect
                    className={styles.inspectorTopSelect}
                    options={inspectorOptions}
                    value={selectedInspectorId}
                    onChange={setSelectedInspectorId}
                    placeholder="Seleccionar inspector"
                    allowClear={false}
                  />
                </label>
              ) : null}
            </div>
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
                <th className={styles.stickyCol}>Viaje (patente + fecha)</th>
                {templates.map((t) => (
                  <th key={t.templateId} title={`${t.title || t.shortTitle || t.templateId} (${t.templateId}) v${t.version}`}>
                    <div className={styles.colHead}>
                      <strong>{t.shortTitle || t.title || t.templateId}</strong>
                      <small>{t.templateId}</small>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr>
                  <td className={styles.emptyCell} colSpan={Math.max(2, templates.length + 1)}>
                    No hay viajes guardados para la fecha seleccionada.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => {
                  const assigned = new Set(trip.assignedTemplateIds || []);
                  const assignedByTemplate = normalizeAssignmentMap(trip.assignedInspectorByTemplate);
                  const changed = changedTripIds.includes(trip._id);
                  return (
                    <tr key={trip._id} className={changed ? styles.changedRow : ""}>
                      <td className={styles.stickyCol}>
                        <div className={styles.tripCell}>
                          <strong>{trip.dominio || "-"}</strong>
                          <small>{formatDateEsFromKey(trip.tripDateKey)}</small>
                          <small>{trip.tipo || ""}</small>
                        </div>
                      </td>
                      {templates.map((t) => (
                        <td key={t.templateId} className={styles.centerCell}>
                          {assignMode === "byChecklist" ? (
                            <>
                              <SearchableInspectorSelect
                                className={styles.inspectorSelect}
                                options={(inspectorsByTemplate[t.templateId] || []).map((inspector) => ({
                                  id: inspector._id,
                                  label: inspectorName(inspector),
                                  keywords: [inspectorName(inspector), inspector.email || "", inspector.inspectorNumber || ""].join(" ").toLowerCase(),
                                }))}
                                value={assignedByTemplate[t.templateId] || ""}
                                disabled={savingAll}
                                onChange={(inspectorId) => setTripTemplateInspector(trip._id, t.templateId, inspectorId)}
                                placeholder="Selec. inspect."
                              />
                              {!assigned.has(t.templateId) && (inspectorsByTemplate[t.templateId] || []).length === 0 ? (
                                <small className={styles.noInspectors}>Sin inspectores habilitados</small>
                              ) : null}
                            </>
                          ) : (
                            (() => {
                              const currentAssignedInspectorId = assignedByTemplate[t.templateId] || "";
                              const assignedToOtherInspector =
                                Boolean(currentAssignedInspectorId) && currentAssignedInspectorId !== selectedInspectorId;
                              const selectedInspectorAllowed = (inspectorsByTemplate[t.templateId] || []).some(
                                (inspector) => inspector._id === selectedInspectorId,
                              );
                              const checkboxDisabled =
                                savingAll || !selectedInspectorId || !selectedInspectorAllowed || assignedToOtherInspector;
                              const checkboxChecked =
                                Boolean(currentAssignedInspectorId) &&
                                (currentAssignedInspectorId === selectedInspectorId || assignedToOtherInspector);

                              return (
                                <div className={styles.inspectorCellWrap}>
                                  <input
                                    type="checkbox"
                                    className={styles.cellCheckbox}
                                    disabled={checkboxDisabled}
                                    checked={checkboxChecked}
                                    onChange={(e) =>
                                      toggleTripTemplateForSelectedInspector(trip._id, t.templateId, e.target.checked)
                                    }
                                    title={
                                      assignedToOtherInspector
                                        ? `Ya asignado a ${inspectorNameById[currentAssignedInspectorId] || "otro inspector"}`
                                        : !selectedInspectorAllowed
                                          ? "El inspector seleccionado no tiene este checklist habilitado"
                                          : ""
                                    }
                                  />
                                  {assignedToOtherInspector ? (
                                    <small className={styles.assignedToOther}>
                                      {inspectorNameById[currentAssignedInspectorId] || "Asignado"}
                                    </small>
                                  ) : null}
                                </div>
                              );
                            })()
                          )}
                        </td>
                      ))}
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
