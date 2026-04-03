import ChecklistViewer from "./viewer";
import ReviewStatusControl from "./ReviewStatusControl";
import { cookies } from "next/headers";
import { getSessionData } from "@/lib/auth";
import { getChecklistWithTemplateById } from "@/lib/checklists";
import { hasAnyRole, hasPermission } from "@/lib/roles";
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
import LocationMapBadge from "./LocationMapBadge";
import styles from "./page.module.css";

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

type AnyObj = Record<string, unknown>;

function asObj(value: unknown): AnyObj {
  return value && typeof value === "object" ? (value as AnyObj) : {};
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getToneByStatus(status: string) {
  const t = normalizeChecklistText(status);
  if (t.includes("APPROV")) return styles.good;
  if (t.includes("REJECT")) return styles.bad;
  if (t.includes("SUBMIT")) return styles.warn;
  if (t.includes("DRAFT")) return styles.muted;
  return styles.neutral;
}

function getToneByDecision(decision: "APPROVED" | "REJECTED" | "PENDING" | null) {
  if (decision === "APPROVED") return styles.good;
  if (decision === "REJECTED") return styles.bad;
  if (decision === "PENDING") return styles.warn;
  return styles.muted;
}

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await getSessionData(token);
  if (!session) throw new Error("No autorizado");

  const { id } = await params;
  const result = await getChecklistWithTemplateById(id);

  if (!result?.checklist) throw new Error("Checklist no encontrado");
  if (!result.template) throw new Error("El template no se pudo cargar");

  const checklist = toPlain(result.checklist) as AnyObj;
  const template = toPlain(result.template) as AnyObj;
  const canViewAll = hasPermission(session as Record<string, unknown>, "checklist.view_all");
  const inspectorRef = checklist?.inspectorId;
  const inspectorId =
    typeof inspectorRef === "string"
      ? inspectorRef
      : inspectorRef && typeof inspectorRef === "object" && "_id" in inspectorRef
        ? String((inspectorRef as Record<string, unknown>)["_id"] ?? "")
        : String(inspectorRef ?? "");
  const isOwner = inspectorId === session.userId;
  if (!canViewAll && !isOwner) throw new Error("No autorizado");

  const inspector = getChecklistInspectorLabel(checklist);
  const inspectorRole = getChecklistInspectorRole(checklist);
  const decisionStatus = getChecklistDecision(checklist);
  const decision = getChecklistDecisionLabel(checklist);
  const status = String(checklist.status ?? "-");
  const approvalData = asObj(asObj(checklist.data).approval);
  const locationStamp = asObj(asObj(asObj(checklist.data).meta).locationStamp);
  const locationLat = asNumber(locationStamp.lat);
  const locationLng = asNumber(locationStamp.lng);
  const approvalNote = String(approvalData.note ?? "").trim();
  const approvalImageUrl = String(approvalData.imageUrl ?? "").trim();
  const checklistTitle = String(template?.title ?? checklist?.title ?? "Checklist");
  const canManageReview = hasAnyRole(session as Record<string, unknown>, ["admin", "manager", "supervisor"]);

  return (
    <ThemeShellServer user={session}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroTitle}>
            <p className={styles.kicker}>Detalle de inspeccion</p>
            <h1>{checklistTitle}</h1>
            <p>
              {template?.title ? String(template.title) : "Checklist"} Â· Vehiculo {String(getChecklistPlate(checklist) ?? "-")}
            </p>
          </div>

          <div className={styles.heroBadges}>
            <span className={`${styles.badge} ${getToneByStatus(status)}`}>{status}</span>
            <span className={`${styles.badge} ${getToneByDecision(decisionStatus)}`}>{decision}</span>
          </div>
        </section>

        <section className={styles.metaPanel}>
          <div className={styles.metaCard}>
            <span>Inspector</span>
            <strong>{inspector}</strong>
            <small>{inspectorRole}</small>
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
          <div className={styles.metaCard}>
            <span>Ubicacion</span>
            <LocationMapBadge lat={locationLat} lng={locationLng} />
            <small>{locationLat !== null && locationLng !== null ? "Click en la badge para abrir mapa" : "Sin coordenadas registradas"}</small>
          </div>
        </section>

        <section className={styles.viewerFrame}>
          <ChecklistViewer template={template} checklist={checklist} />
        </section>

        <ReviewStatusControl
          checklistId={String(checklist?._id ?? "")}
          initialStatus={decisionStatus ?? "PENDING"}
          initialNote={approvalNote}
          initialImageUrl={approvalImageUrl}
          canEdit={canManageReview}
        />
      </main>
    </ThemeShellServer>
  );
}

