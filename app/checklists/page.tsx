import Link from "next/link";
import { cookies } from "next/headers";
import { getSessionData } from "@/lib/auth";
import { listChecklistsForInspector } from "@/lib/checklists";
import { hasPermission } from "@/lib/roles";
import {
  formatChecklistDate,
  getChecklistDecision,
  getChecklistDecisionLabel,
  getChecklistInspectorLabel,
  getChecklistInspectorRole,
  getChecklistPlate,
  getChecklistReviewStatus,
  getChecklistReviewStatusLabel,
  getChecklistTemplateId,
  normalizeChecklistText,
} from "@/lib/checklists-ui";
import ThemeShellServer from "@/components/checklists/ThemeShellServer";
import styles from "./page.module.css";

type ChecklistItem = Record<string, unknown>;
type DecisionFilter = "all" | "approved" | "rejected" | "pending";
type ParamsShape = Record<string, string | string[] | undefined>;

function getDecisionTone(decision: string | null) {
  if (decision === "APPROVED") return "good";
  if (decision === "REJECTED") return "bad";
  if (decision === "PENDING") return "warn";
  return "muted";
}

function getStatusTone(status: string) {
  const s = normalizeChecklistText(status);
  if (s.includes("APPROV")) return "good";
  if (s.includes("REJECT")) return "bad";
  if (s.includes("SUBMIT")) return "warn";
  if (s.includes("DRAFT")) return "muted";
  return "neutral";
}

function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function normalizeDecisionFilter(value: string): DecisionFilter {
  const v = value.toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  if (v === "pending") return "pending";
  return "all";
}

function normalizeDateInput(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function asText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function toDayStart(value: string): Date | null {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDayEnd(value: string): Date | null {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getChecklistDateForFilter(item: ChecklistItem): Date | null {
  const raw = item?.submittedAt ?? item?.createdAt ?? null;
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

function countActiveFilters(input: {
  plate: string;
  templateId: string;
  decision: DecisionFilter;
  dateFrom: string;
  dateTo: string;
}) {
  let total = 0;
  if (input.plate) total += 1;
  if (input.templateId) total += 1;
  if (input.decision !== "all") total += 1;
  if (input.dateFrom) total += 1;
  if (input.dateTo) total += 1;
  return total;
}

export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams?: Promise<ParamsShape>;
}) {
  const sp = (await searchParams) ?? {};
  const plateFilter = readParam(sp.plate);
  const templateFilter = readParam(sp.templateId);
  const decisionFilter = normalizeDecisionFilter(readParam(sp.decision));
  const dateFrom = normalizeDateInput(readParam(sp.dateFrom));
  const dateTo = normalizeDateInput(readParam(sp.dateTo));
  const dateFromBound = toDayStart(dateFrom);
  const dateToBound = toDayEnd(dateTo);

  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await getSessionData(token);

  if (!session) throw new Error("No autorizado");

  const items = (await listChecklistsForInspector({
    inspectorId: session.userId,
    includeAll: hasPermission(session as Record<string, unknown>, "checklist.view_all"),
  })) as ChecklistItem[];

  const templateOptions = Array.from(
    new Set(
      items
        .map((item) => asText(getChecklistTemplateId(item)))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const baseStats = {
    total: items.length,
    approved: 0,
    rejected: 0,
    pending: 0,
    drafts: 0,
    reviewed: 0,
    unreviewed: 0,
  };

  for (const item of items) {
    const decision = getChecklistDecision(item);
    const status = normalizeChecklistText(item?.status);
    const reviewStatus = getChecklistReviewStatus(item);

    if (decision === "APPROVED") baseStats.approved += 1;
    else if (decision === "REJECTED") baseStats.rejected += 1;
    else baseStats.pending += 1;

    if (status === "DRAFT") baseStats.drafts += 1;
    if (reviewStatus === "REVISADO") baseStats.reviewed += 1;
    else baseStats.unreviewed += 1;
  }

  const visibleItems = items.filter((item) => {
    const decision = getChecklistDecision(item);
    const templateId = asText(getChecklistTemplateId(item));
    const plate = asText(getChecklistPlate(item));
    const filterDate = getChecklistDateForFilter(item);

    if (decisionFilter === "approved" && decision !== "APPROVED") return false;
    if (decisionFilter === "rejected" && decision !== "REJECTED") return false;
    if (decisionFilter === "pending" && decision !== "PENDING") return false;

    if (templateFilter && templateId.toLowerCase() !== templateFilter.toLowerCase()) return false;
    if (plateFilter && !plate.toLowerCase().includes(plateFilter.toLowerCase())) return false;

    if (dateFromBound && (!filterDate || filterDate < dateFromBound)) return false;
    if (dateToBound && (!filterDate || filterDate > dateToBound)) return false;

    return true;
  });

  const activeFilters = countActiveFilters({
    plate: plateFilter,
    templateId: templateFilter,
    decision: decisionFilter,
    dateFrom,
    dateTo,
  });

  return (
    <ThemeShellServer user={session}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Panel de inspecciones</p>
            <h1 className={styles.title}>Checklists</h1>
            <p className={styles.subtitle}>
              Seguimiento de checklists enviados con filtros por patente, fecha, template, estado y decision.
            </p>
          </div>
        </section>

        <section className={styles.statsGrid} aria-label="Resumen">
          <article className={styles.statCard}>
            <span>Total</span>
            <strong>{baseStats.total}</strong>
            <small>checklists</small>
          </article>
          <article className={cx(styles.statCard, styles.good)}>
            <span>Aprobados</span>
            <strong>{baseStats.approved}</strong>
            <small>con decision positiva</small>
          </article>
          <article className={cx(styles.statCard, styles.bad)}>
            <span>Rechazados</span>
            <strong>{baseStats.rejected}</strong>
            <small>requieren correccion</small>
          </article>
          <article className={cx(styles.statCard, styles.warn)}>
            <span>Pendientes</span>
            <strong>{baseStats.pending}</strong>
            <small>sin decision final</small>
          </article>
        </section>

        <section className={styles.listSection}>
          <form method="get" className={styles.filterPanel}>
            <div className={styles.filterGrid}>
              <label className={styles.field}>
                <span>Patente</span>
                <input name="plate" defaultValue={plateFilter} placeholder="Ej: AB123CD" />
              </label>

              <label className={styles.field}>
                <span>Template</span>
                <select name="templateId" defaultValue={templateFilter}>
                  <option value="">Todos</option>
                  {templateOptions.map((templateId) => (
                    <option key={templateId} value={templateId}>
                      {templateId}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Decision</span>
                <select name="decision" defaultValue={decisionFilter}>
                  <option value="all">Todas</option>
                  <option value="approved">Aprobado</option>
                  <option value="rejected">Rechazado</option>
                  <option value="pending">Pendiente</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>Fecha desde</span>
                <input type="date" name="dateFrom" defaultValue={dateFrom} />
              </label>

              <label className={styles.field}>
                <span>Fecha hasta</span>
                <input type="date" name="dateTo" defaultValue={dateTo} />
              </label>
            </div>

            <div className={styles.filterActions}>
              <button type="submit" className={styles.applyButton}>
                Aplicar filtros
              </button>
              <Link href="/checklists" className={styles.clearButton}>
                Limpiar
              </Link>
            </div>
          </form>

          <div className={styles.listHeader}>
            <h2>Actividad reciente</h2>
            <p>
              {visibleItems.length} resultado(s)
              {activeFilters > 0 ? ` con ${activeFilters} filtro(s) activo(s)` : ""}
            </p>
          </div>

          {visibleItems.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No hay checklists para este filtro</h3>
              <p>Ajusta los filtros o usa "Limpiar" para volver a ver todo.</p>
            </div>
          ) : (
            <ul className={styles.cards}>
              {visibleItems.map((item) => {
                const decision = getChecklistDecision(item);
                const reviewStatus = getChecklistReviewStatus(item);
                const plate = getChecklistPlate(item);
                const statusLabel = asText(item?.status, "Sin estado");
                const templateLabel = `${asText(getChecklistTemplateId(item), "template")} v${asText(item?.templateVersion, "?")}`;
                const createdAt = formatChecklistDate(item?.createdAt);
                const submittedAt = formatChecklistDate(item?.submittedAt);
                const inspectorLabel = getChecklistInspectorLabel(item);
                const id = asText(item?._id);

                return (
                  <li key={id} className={styles.cardWrap}>
                    <Link href={`/checklists/${id}`} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div className={styles.templateBlock}>
                          <span className={styles.templateEyebrow}>Template</span>
                          <h3>{templateLabel}</h3>
                          <p>
                            {plate ? `Vehiculo ${String(plate)}` : "Sin patente registrada"} - ID {id.slice(-6)}
                          </p>
                        </div>
                        <div className={styles.badges}>
                          <span className={cx(styles.badge, styles[getStatusTone(statusLabel)])}>{statusLabel}</span>
                          <span className={cx(styles.badge, styles[getDecisionTone(decision)])}>
                            {getChecklistDecisionLabel(item)}
                          </span>
                          <span className={cx(styles.badge, reviewStatus === "REVISADO" ? styles.good : styles.muted)}>
                            {getChecklistReviewStatusLabel(item)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.metaGrid}>
                        <div>
                          <span>Inspector</span>
                          <strong>{inspectorLabel}</strong>
                        </div>
                        <div>
                          <span>Creado</span>
                          <strong>{createdAt}</strong>
                        </div>
                        <div>
                          <span>Enviado</span>
                          <strong>{submittedAt}</strong>
                        </div>
                        <div>
                          <span>Rol</span>
                          <strong>{getChecklistInspectorRole(item)}</strong>
                        </div>
                      </div>

                      <div className={styles.cardFooter}>
                        <span>Ver detalle completo</span>
                        <span aria-hidden>-&gt;</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </ThemeShellServer>
  );
}
