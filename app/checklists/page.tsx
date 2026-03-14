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
  normalizeChecklistText,
} from "@/lib/checklists-ui";
import ThemeShellServer from "@/components/checklists/ThemeShellServer";
import styles from "./page.module.css";

type ChecklistItem = any;

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

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default async function ChecklistsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await getSessionData(token);

  if (!session) throw new Error("No autorizado");

  const items = (await listChecklistsForInspector({
    inspectorId: session.userId,
    includeAll: hasPermission(session as any, "checklist.view_all"),
  })) as ChecklistItem[];

  const stats = {
    total: items.length,
    approved: 0,
    rejected: 0,
    pending: 0,
    drafts: 0,
  };

  for (const item of items) {
    const decision = getChecklistDecision(item);
    const status = normalizeChecklistText(item?.status);
    if (decision === "APPROVED") stats.approved += 1;
    else if (decision === "REJECTED") stats.rejected += 1;
    else stats.pending += 1;
    if (status === "DRAFT") stats.drafts += 1;
  }

  return (
    <ThemeShellServer user={session}>
      <main className={styles.page}>
        <div className={styles.backdrop} aria-hidden />

        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Panel de inspecciones</p>
            <h1 className={styles.title}>Checklists</h1>
            <p className={styles.subtitle}>
              Resumen de formularios enviados, su estado operativo y el resultado de revisión.
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
            <small>con revisión positiva</small>
          </article>
          <article className={cx(styles.statCard, styles.bad)}>
            <span>Rechazados</span>
            <strong>{stats.rejected}</strong>
            <small>requieren corrección</small>
          </article>
          <article className={cx(styles.statCard, styles.warn)}>
            <span>Pendientes</span>
            <strong>{stats.pending}</strong>
            <small>sin decisión final</small>
          </article>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listHeader}>
            <h2>Actividad reciente</h2>
            <p>{stats.drafts} borrador(es) y {stats.total - stats.drafts} enviados</p>
          </div>

          {items.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No hay checklists todavía</h3>
              <p>Cuando completes una inspección, aparecerá acá con su estado y resultado.</p>
            </div>
          ) : (
            <ul className={styles.cards}>
              {items.map((item) => {
                const decision = getChecklistDecision(item);
                const plate = getChecklistPlate(item);
                const statusLabel = String(item?.status ?? "Sin estado");
                const templateLabel = `${item?.templateId ?? "template"} v${item?.templateVersion ?? "?"}`;
                const createdAt = formatChecklistDate(item?.createdAt);
                const submittedAt = formatChecklistDate(item?.submittedAt);
                const inspectorLabel = getChecklistInspectorLabel(item);

                return (
                  <li key={String(item._id)} className={styles.cardWrap}>
                    <Link href={`/checklists/${item._id}`} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div className={styles.templateBlock}>
                          <span className={styles.templateEyebrow}>Template</span>
                          <h3>{templateLabel}</h3>
                          <p>
                            {plate ? `Vehículo ${plate}` : "Sin patente registrada"} · ID {String(item._id).slice(-6)}
                          </p>
                        </div>
                        <div className={styles.badges}>
                          <span className={cx(styles.badge, styles[getStatusTone(statusLabel)])}>
                            {statusLabel}
                          </span>
                          <span className={cx(styles.badge, styles[getDecisionTone(decision)])}>
                            {getChecklistDecisionLabel(item)}
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
                          <strong>
                            {getChecklistInspectorRole(item)}
                          </strong>
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

