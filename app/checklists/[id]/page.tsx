import ChecklistViewer from "./viewer";
import { cookies } from "next/headers";
import { getSessionData } from "@/lib/auth";
import { getChecklistWithTemplateById } from "@/lib/checklists";
import {
  formatChecklistDate,
  getChecklistDecision,
  getChecklistDecisionLabel,
  getChecklistInspectorLabel,
  getChecklistInspectorRole,
  getChecklistPlate,
  getChecklistVisibility,
  normalizeChecklistText,
} from "@/lib/checklists-ui";
import ThemeShellServer from "@/components/checklists/ThemeShellServer";
import styles from "./page.module.css";

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

type AnyObj = Record<string, any>;

function getToneByStatus(status: string) {
  const t = normalizeChecklistText(status);
  if (t.includes("APPROV")) return styles.good;
  if (t.includes("REJECT")) return styles.bad;
  if (t.includes("SUBMIT")) return styles.warn;
  if (t.includes("DRAFT")) return styles.muted;
  return styles.neutral;
}

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await getSessionData(token);

  const { id } = await params;
  const result = await getChecklistWithTemplateById(id);

  if (!result?.checklist) throw new Error("Checklist no encontrado");
  if (!result.template) throw new Error("El template no se pudo cargar");

  const checklist = toPlain(result.checklist) as AnyObj;
  const template = toPlain(result.template) as AnyObj;

  const inspector = getChecklistInspectorLabel(checklist);
  const inspectorRole = getChecklistInspectorRole(checklist);
  const visibility = getChecklistVisibility(checklist);
  const decision = getChecklistDecisionLabel(checklist);
  const status = String(checklist.status ?? "—");

  return (
    <ThemeShellServer user={session}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroTitle}>
            <p className={styles.kicker}>Detalle de inspección</p>
            <h1>
              {String(checklist.templateId ?? "Template")} v{String(checklist.templateVersion ?? "—")}
            </h1>
            <p>
              {template?.title ? String(template.title) : "Checklist"} · Vehículo {String(getChecklistPlate(checklist) ?? "—")}
            </p>
          </div>

          <div className={styles.heroBadges}>
            <span className={`${styles.badge} ${getToneByStatus(status)}`}>{status}</span>
            <span className={`${styles.badge} ${getToneByStatus(decision)}`}>{decision}</span>
          </div>
        </section>

        <section className={styles.metaPanel}>
          <div className={styles.metaCard}>
            <span>Inspector</span>
            <strong>{inspector}</strong>
            <small>{inspectorRole}</small>
          </div>
          <div className={styles.metaCard}>
            <span>Visibilidad</span>
            <strong>{visibility}</strong>
            <small>{String(checklist._id)}</small>
          </div>
          <div className={styles.metaCard}>
            <span>Creado</span>
            <strong>{formatChecklistDate(checklist.createdAt)}</strong>
            <small>Actualizado: {formatChecklistDate(checklist.updatedAt)}</small>
          </div>
          <div className={styles.metaCard}>
            <span>Enviado</span>
            <strong>{formatChecklistDate(checklist.submittedAt)}</strong>
            <small>Resultado: {decision}</small>
          </div>
        </section>

        <section className={styles.viewerFrame}>
          <ChecklistViewer template={template} checklist={checklist} />
        </section>
      </main>
    </ThemeShellServer>
  );
}
