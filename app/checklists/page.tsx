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
  normalizeChecklistText,
} from "@/lib/checklists-ui";
import ThemeShellServer from "@/components/checklists/ThemeShellServer";
import styles from "./page.module.css";

type ChecklistItem = Record<string, unknown>;
type ReviewFilter = "all" | "revisado" | "sin_revision";

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

function normalizeReviewFilter(value: string | undefined): ReviewFilter {
  const v = String(value || "").trim().toLowerCase();
  if (v === "revisado") return "revisado";
  if (v === "sin_revision") return "sin_revision";
  return "all";
}

function asText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams?: Promise<{ review?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const reviewFilter = normalizeReviewFilter(sp.review);

  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await getSessionData(token);

  if (!session) throw new Error("No autorizado");

  const items = (await listChecklistsForInspector({
    inspectorId: session.userId,
    includeAll: hasPermission(session as Record<string, unknown>, "checklist.view_all"),
  })) as ChecklistItem[];

  const stats = {
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

    if (decision === "APPROVED") stats.approved += 1;
    else if (decision === "REJECTED") stats.rejected += 1;
    else stats.pending += 1;

    if (status === "DRAFT") stats.drafts += 1;
    if (reviewStatus === "REVISADO") stats.reviewed += 1;
    else stats.unreviewed += 1;
  }

  const visibleItems = items.filter((item) => {
    const reviewStatus = getChecklistReviewStatus(item);
    if (reviewFilter === "revisado") return reviewStatus === "REVISADO";
    if (reviewFilter === "sin_revision") return reviewStatus !== "REVISADO";
    return true;
  });

  return (
    <ThemeShellServer user={session}>
      <main className={styles.page}>
        <div className={styles.backdrop} aria-hidden />

        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Panel de inspecciones</p>
            <h1 className={styles.title}>Checklists</h1>
            <p className={styles.subtitle}>
              Resumen de formularios enviados, su estado operativo y estado de revision.
            </p>
          </div>
        </section>

        <section className={styles.statsGrid} aria-label="Resumen">
          <article className={styles.statCard}>
            <span>Total</span>
            <strong>{stats.total}</strong>
            <small>checklists</small>
          </article>
          <article className={cx(styles.statCard, styles.good)}>
            <span>Aprobados</span>
            <strong>{stats.approved}</strong>
            <small>con decision positiva</small>
          </article>
          <article className={cx(styles.statCard, styles.bad)}>
            <span>Rechazados</span>
            <strong>{stats.rejected}</strong>
            <small>requieren correccion</small>
          </article>
          <article className={cx(styles.statCard, styles.warn)}>
            <span>Pendientes</span>
            <strong>{stats.pending}</strong>
            <small>sin decision final</small>
          </article>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listHeader}>
            <h2>Actividad reciente</h2>
            <p>
              {stats.drafts} borrador(es) y {stats.total - stats.drafts} enviados
            </p>
          </div>

          <div className={styles.filters}>
            <Link href="/checklists" className={cx(styles.filterChip, reviewFilter === "all" && styles.filterChipActive)}>
              Todos ({stats.total})
            </Link>
            <Link
              href="/checklists?review=revisado"
              className={cx(styles.filterChip, reviewFilter === "revisado" && styles.filterChipActive)}
            >
              Revisados ({stats.reviewed})
            </Link>
            <Link
              href="/checklists?review=sin_revision"
              className={cx(styles.filterChip, reviewFilter === "sin_revision" && styles.filterChipActive)}
            >
              Sin revision ({stats.unreviewed})
            </Link>
          </div>

          {visibleItems.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No hay checklists para este filtro</h3>
              <p>Cambia el filtro o vuelve a &quot;Todos&quot; para ver mas resultados.</p>
            </div>
          ) : (
            <ul className={styles.cards}>
              {visibleItems.map((item) => {
                const decision = getChecklistDecision(item);
                const reviewStatus = getChecklistReviewStatus(item);
                const plate = getChecklistPlate(item);
                const statusLabel = asText(item?.status, "Sin estado");
                const templateLabel = `${asText(item?.templateId, "template")} v${asText(item?.templateVersion, "?")}`;
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
                            {plate ? `Vehiculo ${String(plate)}` : "Sin patente registrada"} · ID {id.slice(-6)}
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
                        <span aria-hidden>↗</span>
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
