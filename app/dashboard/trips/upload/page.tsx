"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
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

type TripRow = {
  _id?: string;
  solicitudRaw: string;
  solicitudAtIso?: string | null;
  solicitudDisplay: string;
  tipo: string;
  dominio: string;
  viajeRaw: string;
  viajeDisplay: string;
  viajeDateKey: string;
  rowIndex: number;
};

function normalizeHeader(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateEs(input: Date | null) {
  if (!input) return "";
  const day = String(input.getDate()).padStart(2, "0");
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const year = input.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTimeEs(input: Date | null) {
  if (!input) return "";
  const date = formatDateEs(input);
  const hh = String(input.getHours()).padStart(2, "0");
  const mm = String(input.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

function parseDateValue(input: unknown): Date | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    const parsed = XLSX.SSF.parse_date_code(input);
    if (parsed) {
      const d = new Date(parsed.y, parsed.m - 1, parsed.d);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;

  const value = String(input ?? "").trim();
  if (!value) return null;

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dmY = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2})?$/.exec(value);
  if (dmY) {
    const day = Number(dmY[1]);
    const month = Number(dmY[2]);
    const year = Number(dmY[3].length === 2 ? `20${dmY[3]}` : dmY[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso;

  return null;
}

function pickValue(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const target = normalizeHeader(name);
    const hit = entries.find(([k]) => normalizeHeader(k) === target);
    if (hit) return hit[1];
  }
  return "";
}

function detectHeaderRowIndex(rows: unknown[][]) {
  for (let i = 0; i < rows.length; i += 1) {
    const normalized = (rows[i] || []).map((c) => normalizeHeader(String(c ?? "")));
    const hasSolicitud = normalized.includes("SOLICITUD");
    const hasTipo = normalized.includes("TIPO");
    const hasDominio = normalized.includes("DOMINIO");
    const hasViaje = normalized.includes("VIAJE");
    if (hasSolicitud && hasTipo && hasDominio && hasViaje) return i;
  }
  return -1;
}

export default function TripsDashboardPage() {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<TripRow[]>([]);
  const [savedRows, setSavedRows] = React.useState<TripRow[]>([]);
  const [selectedDate, setSelectedDate] = React.useState(formatDateKey(new Date()));
  const [fileName, setFileName] = React.useState("");
  const [savingTrips, setSavingTrips] = React.useState(false);
  const [creatingTrip, setCreatingTrip] = React.useState(false);
  const [savingCreate, setSavingCreate] = React.useState(false);
  const [editingTrip, setEditingTrip] = React.useState<TripRow | null>(null);
  const [editForm, setEditForm] = React.useState({
    solicitudRaw: "",
    tipo: "",
    dominio: "",
    viajeDateKey: "",
  });
  const [createForm, setCreateForm] = React.useState({
    solicitudAt: "",
    tipo: "",
    dominio: "",
    viajeDateKey: formatDateKey(new Date()),
  });
  const [savingEdit, setSavingEdit] = React.useState(false);

  const fetchSavedTrips = React.useCallback(async (dateKey: string) => {
    try {
      const res = await fetch(`/api/trips?date=${encodeURIComponent(dateKey)}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "No se pudieron cargar viajes guardados");

      const items = Array.isArray(data.items) ? data.items : [];
      const mapped: TripRow[] = items.map((it: any, idx: number) => {
        const solicitudAt = parseDateValue(it?.solicitudAt);
        const viajeDate = parseDateValue(it?.tripDateKey);
        return {
          _id: String(it?._id || ""),
          solicitudRaw: String(it?.solicitudRaw || "").trim(),
          solicitudAtIso: solicitudAt ? solicitudAt.toISOString() : null,
          solicitudDisplay: formatDateTimeEs(solicitudAt) || String(it?.solicitudRaw || "").trim(),
          tipo: String(it?.tipo || "").trim(),
          dominio: String(it?.dominio || "").trim().toUpperCase(),
          viajeRaw: String(it?.viajeRaw || "").trim(),
          viajeDisplay: formatDateEs(viajeDate) || String(it?.viajeRaw || "").trim(),
          viajeDateKey: String(it?.tripDateKey || ""),
          rowIndex: idx + 1,
        };
      });
      setSavedRows(mapped);
    } catch (e: any) {
      setSavedRows([]);
      setError(e.message || "No se pudieron cargar viajes guardados");
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

        const allowed =
          hasPermission(data.user as any, "checklist.view_all") ||
          hasAnyRole(data.user as any, ["admin", "manager", "supervisor"]);

        if (!allowed) {
          router.push("/dashboard");
          return;
        }

        if (!cancelled) setMe(data.user);
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
  }, [router]);

  React.useEffect(() => {
    void fetchSavedTrips(selectedDate);
  }, [fetchSavedTrips, selectedDate]);

  async function onFileSelected(file: File | null) {
    if (!file) return;

    setError(null);
    setSuccess(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("El archivo no tiene hojas");
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rowsAoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: true,
        blankrows: false,
      });

      if (!Array.isArray(rowsAoa) || rowsAoa.length === 0) {
        throw new Error("No se encontraron filas en el Excel");
      }

      const headerRowIndex = detectHeaderRowIndex(rowsAoa);
      if (headerRowIndex < 0) {
        throw new Error("No se encontraron columnas requeridas: SOLICITUD, TIPO, DOMINIO, VIAJE");
      }

      const headerRow = rowsAoa[headerRowIndex] || [];
      const normalizedHeader = headerRow.map((c) => normalizeHeader(String(c ?? "")));
      const idxSolicitud = normalizedHeader.indexOf("SOLICITUD");
      const idxTipo = normalizedHeader.indexOf("TIPO");
      const idxDominio = normalizedHeader.indexOf("DOMINIO");
      const idxViaje = normalizedHeader.indexOf("VIAJE");

      const mapped: TripRow[] = [];
      for (let i = headerRowIndex + 1; i < rowsAoa.length; i += 1) {
        const row = rowsAoa[i] || [];
        const solicitudValue = idxSolicitud >= 0 ? row[idxSolicitud] : "";
        const solicitud = String(solicitudValue ?? "").trim();
        const tipo = String(idxTipo >= 0 ? row[idxTipo] ?? "" : "").trim();
        const dominio = String(idxDominio >= 0 ? row[idxDominio] ?? "" : "").trim().toUpperCase();
        const viajeValue = idxViaje >= 0 ? row[idxViaje] : "";
        const solicitudDate = parseDateValue(solicitudValue);
        const viajeDate = parseDateValue(viajeValue);
        const viajeDateKey = viajeDate ? formatDateKey(viajeDate) : "";

        if (!solicitud && !tipo && !dominio && !viajeDateKey) continue;

        mapped.push({
          solicitudRaw: solicitud,
          solicitudAtIso: solicitudDate ? solicitudDate.toISOString() : null,
          solicitudDisplay: formatDateTimeEs(solicitudDate) || solicitud,
          tipo,
          dominio,
          viajeRaw: String(viajeValue ?? "").trim(),
          viajeDisplay: formatDateEs(viajeDate) || String(viajeValue ?? "").trim(),
          viajeDateKey,
          rowIndex: i + 1,
        });
      }

      if (mapped.length === 0) {
        throw new Error("No hay viajes validos para procesar");
      }

      setRows(mapped);
      setFileName(file.name);
      setSuccess(null);
    } catch (e: any) {
      setRows([]);
      setFileName("");
      setError(e.message || "No se pudo leer el archivo");
    }
  }

  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => r.viajeDateKey === selectedDate);
  }, [rows, selectedDate]);

  const activeRows = rows.length > 0 ? filteredRows : savedRows;

  async function saveTripsToDatabase() {
    if (!rows.length || savingTrips) return;
    setSavingTrips(true);
    setError(null);
    setSuccess(null);
    try {
      const payloadRows = rows.map((r) => ({
        solicitudRaw: r.solicitudRaw,
        solicitudAtIso: r.solicitudAtIso || null,
        tipo: r.tipo,
        dominio: r.dominio,
        viajeRaw: r.viajeRaw,
        viajeDateKey: r.viajeDateKey,
      }));

      const res = await fetch("/api/trips", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFile: fileName, rows: payloadRows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "No se pudieron guardar los viajes");
      }

      const saved = Number(data?.saved || payloadRows.length);
      setSuccess(`Viajes guardados correctamente (${saved}).`);
      setRows([]);
      await fetchSavedTrips(selectedDate);
    } catch (e: any) {
      setError(e.message || "No se pudieron guardar los viajes");
    } finally {
      setSavingTrips(false);
    }
  }

  function startEditTrip(row: TripRow) {
    setError(null);
    setSuccess(null);
    setEditingTrip(row);
    setEditForm({
      solicitudRaw: row.solicitudRaw || "",
      tipo: row.tipo || "",
      dominio: (row.dominio || "").toUpperCase(),
      viajeDateKey: row.viajeDateKey || selectedDate,
    });
  }

  function startCreateTrip() {
    setError(null);
    setSuccess(null);
    setCreateForm({
      solicitudAt: "",
      tipo: "",
      dominio: "",
      viajeDateKey: selectedDate,
    });
    setCreatingTrip(true);
  }

  function closeCreateTrip() {
    setCreatingTrip(false);
    setSavingCreate(false);
  }

  async function saveCreateTrip() {
    if (savingCreate) return;
    const tipo = createForm.tipo.trim();
    const dominio = createForm.dominio.trim().toUpperCase();
    const viajeDateKey = createForm.viajeDateKey.trim();
    if (!tipo || !dominio || !viajeDateKey) {
      setError("Completá tipo, dominio y fecha de viaje");
      return;
    }

    setSavingCreate(true);
    setError(null);
    setSuccess(null);
    try {
      const solicitudDate = createForm.solicitudAt ? new Date(createForm.solicitudAt) : null;
      const solicitudRaw = solicitudDate ? formatDateTimeEs(solicitudDate) : "";
      const payload = {
        sourceFile: "carga-manual",
        rows: [
          {
            solicitudRaw,
            solicitudAtIso: solicitudDate ? solicitudDate.toISOString() : null,
            tipo,
            dominio,
            viajeRaw: formatDateEs(parseDateValue(viajeDateKey)) || viajeDateKey,
            viajeDateKey,
          },
        ],
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "No se pudo guardar el viaje");

      setSuccess("Viaje cargado manualmente");
      closeCreateTrip();
      await fetchSavedTrips(selectedDate);
    } catch (e: any) {
      setError(e.message || "No se pudo guardar el viaje");
    } finally {
      setSavingCreate(false);
    }
  }

  function closeEditTrip() {
    setEditingTrip(null);
    setSavingEdit(false);
  }

  async function saveEditTrip() {
    if (!editingTrip?._id || savingEdit) return;
    setSavingEdit(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        solicitudRaw: editForm.solicitudRaw.trim(),
        tipo: editForm.tipo.trim(),
        dominio: editForm.dominio.trim().toUpperCase(),
        viajeDateKey: editForm.viajeDateKey,
      };
      const res = await fetch(`/api/trips/${editingTrip._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "No se pudo guardar cambios");
      setSuccess("Viaje actualizado");
      closeEditTrip();
      await fetchSavedTrips(selectedDate);
    } catch (e: any) {
      setError(e.message || "No se pudo guardar cambios");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteTrip(row: TripRow) {
    if (!row._id) return;
    if (!confirm("¿Eliminar este viaje?")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/trips/${row._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "No se pudo eliminar");
      setSuccess("Viaje eliminado");
      await fetchSavedTrips(selectedDate);
    } catch (e: any) {
      setError(e.message || "No se pudo eliminar");
    }
  }

  const stats = React.useMemo(() => {
    const ida = activeRows.filter((r) => /IDA/i.test(r.tipo)).length;
    const retorno = activeRows.filter((r) => /RETORNO/i.test(r.tipo)).length;
    return {
      totalLoaded: rows.length > 0 ? rows.length : savedRows.length,
      totalDay: activeRows.length,
      ida,
      retorno,
    };
  }, [rows.length, rows, savedRows.length, savedRows, activeRows]);

  if (loading) {
    return (
      <ThemeShell user={me}>
        <main className={styles.page}>
          <div className={styles.loading}>Cargando módulo de viajes...</div>
        </main>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={me}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Operación diaria</p>
            <h1>Viajes del día</h1>
            <p className={styles.subtitle}>
              Subi el Excel del dia y filtra por fecha de la columna VIAJE para validar exactamente los viajes esperados.
            </p>
          </div>
          <a href="/dashboard" className={styles.secondaryBtn}>Volver al panel</a>
        </section>

        <section className={styles.controls}>
          <label className={styles.field}>
            <span>Archivo Excel (.xlsx, .xls)</span>
            <div className={styles.filePicker}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className={styles.fileInputHidden}
                onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={styles.fileBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                Seleccionar archivo
              </button>
              <span className={styles.fileName}>{fileName || "Ningún archivo seleccionado"}</span>
            </div>
          </label>

          <label className={styles.field}>
            <span>Fecha de viaje</span>
            <div className={styles.dateSelector}>
              <input
                type="text"
                className={styles.dateDisplay}
                value={formatDateEs(parseDateValue(selectedDate)) || ""}
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
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  lang="es-AR"
                  aria-label="Selector de fecha"
                />
              </label>
            </div>
          </label>

          <div className={`${styles.field} ${styles.actionField}`}>
            <span>Acción</span>
            <button type="button" className={styles.primaryBtn} onClick={startCreateTrip}>
              Cargar viaje manual
            </button>
          </div>
        </section>

        {(error || success) && (
          <section className={styles.messages}>
            {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
            {success ? <div className={`${styles.message} ${styles.success}`}>{success}</div> : null}
          </section>
        )}

        {rows.length > 0 ? (
          <section className={styles.pendingBox}>
            <p>Se cargaron {rows.length} viajes. ¿Deseas guardarlos en la base de datos?</p>
            <button type="button" className={styles.primaryBtn} onClick={() => void saveTripsToDatabase()} disabled={savingTrips}>
              {savingTrips ? "Guardando..." : "Guardar viajes"}
            </button>
          </section>
        ) : null}

        <section className={styles.stats}>
          <article>
            <span>Archivo</span>
            <strong>{fileName || "Sin cargar"}</strong>
          </article>
          <article>
            <span>Total cargados</span>
            <strong>{stats.totalLoaded}</strong>
          </article>
          <article>
            <span>Viajes del dia</span>
            <strong>{stats.totalDay}</strong>
          </article>
          <article>
            <span>IDA / RETORNO</span>
            <strong>{stats.ida} / {stats.retorno}</strong>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>SOLICITUD</th>
                <th>TIPO</th>
                <th>DOMINIO</th>
                <th>VIAJE</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>No hay viajes para la fecha seleccionada.</td>
                </tr>
              ) : (
                activeRows.map((r) => (
                  <tr key={`${r.rowIndex}-${r.dominio}-${r.viajeDateKey}`}>
                    <td>{r.rowIndex}</td>
                    <td>{r.solicitudDisplay || r.solicitudRaw || "-"}</td>
                    <td>{r.tipo || "-"}</td>
                    <td>{r.dominio || "-"}</td>
                    <td>{r.viajeDisplay || r.viajeDateKey || "-"}</td>
                    <td>
                      {rows.length === 0 ? (
                        <div className={styles.actions}>
                          <button type="button" className={styles.actionBtn} onClick={() => startEditTrip(r)}>
                            Editar
                          </button>
                          <button type="button" className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => void deleteTrip(r)}>
                            Eliminar
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {editingTrip ? (
          <div className={styles.modalOverlay} onClick={closeEditTrip} role="presentation">
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <h3>Editar viaje</h3>
              <div className={styles.modalGrid}>
                <label className={styles.field}>
                  <span>Solicitud</span>
                  <input
                    value={editForm.solicitudRaw}
                    onChange={(e) => setEditForm((p) => ({ ...p, solicitudRaw: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Tipo</span>
                  <input
                    value={editForm.tipo}
                    onChange={(e) => setEditForm((p) => ({ ...p, tipo: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Dominio</span>
                  <input
                    value={editForm.dominio}
                    onChange={(e) => setEditForm((p) => ({ ...p, dominio: e.target.value.toUpperCase() }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Viaje</span>
                  <input
                    type="date"
                    value={editForm.viajeDateKey}
                    onChange={(e) => setEditForm((p) => ({ ...p, viajeDateKey: e.target.value }))}
                  />
                </label>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={closeEditTrip}>
                  Cancelar
                </button>
                <button type="button" className={styles.primaryBtn} onClick={() => void saveEditTrip()} disabled={savingEdit}>
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {creatingTrip ? (
          <div className={styles.modalOverlay} onClick={closeCreateTrip} role="presentation">
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <h3>Nuevo viaje manual</h3>
              <div className={styles.modalGrid}>
                <label className={styles.field}>
                  <span>Solicitud (fecha y hora)</span>
                  <input
                    type="datetime-local"
                    value={createForm.solicitudAt}
                    onChange={(e) => setCreateForm((p) => ({ ...p, solicitudAt: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Tipo</span>
                  <select
                    value={createForm.tipo}
                    onChange={(e) => setCreateForm((p) => ({ ...p, tipo: e.target.value }))}
                  >
                    <option value="">Seleccionar tipo</option>
                    <option value="Viaje de IDA">Viaje de IDA</option>
                    <option value="Viaje de RETORNO">Viaje de RETORNO</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Dominio</span>
                  <input
                    value={createForm.dominio}
                    onChange={(e) => setCreateForm((p) => ({ ...p, dominio: e.target.value.toUpperCase() }))}
                    placeholder="AA123BB"
                  />
                </label>
                <label className={styles.field}>
                  <span>Fecha de viaje</span>
                  <input
                    type="date"
                    value={createForm.viajeDateKey}
                    onChange={(e) => setCreateForm((p) => ({ ...p, viajeDateKey: e.target.value }))}
                  />
                </label>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={closeCreateTrip}>
                  Cancelar
                </button>
                <button type="button" className={styles.primaryBtn} onClick={() => void saveCreateTrip()} disabled={savingCreate}>
                  {savingCreate ? "Guardando..." : "Guardar viaje"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ThemeShell>
  );
}

