import { connectToDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { hasAnyRole, hasPermission } from "@/lib/roles";
import Trip from "@/models/Trip";
import Checklist from "@/models/Checklist";
import ChecklistTemplate from "@/models/ChecklistTemplate";

function normalizeDateKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateRangeForKey(key: string) {
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(`${key}T23:59:59.999Z`);
  return { start, end };
}

function normalizePlate(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function readFieldValue(value: unknown): string {
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const nested = (value as Record<string, unknown>).value;
    return typeof nested === "string" || typeof nested === "number" ? String(nested) : "";
  }
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function checklistPlate(row: any): string {
  const fromSubject =
    row?.data?.subject?.vehicle_domain ??
    row?.data?.subject?.vehicleDomain ??
    row?.data?.subject?.plate ??
    row?.data?.subject?.patente ??
    row?.data?.subject?.dominio ??
    row?.data?.subject?.vehiclePlate;
  const fromValues =
    row?.data?.values?.vehicle_domain ??
    row?.data?.values?.vehicleDomain ??
    row?.data?.values?.pre_plate ??
    row?.data?.values?.plate ??
    row?.data?.values?.patente ??
    row?.data?.values?.dominio;
  const fromMeta =
    row?.data?.meta?.vehicle_domain ??
    row?.data?.meta?.vehicleDomain ??
    row?.data?.meta?.plate ??
    row?.data?.meta?.patente ??
    row?.data?.meta?.dominio;
  return normalizePlate(readFieldValue(fromSubject ?? fromValues ?? fromMeta ?? ""));
}

function isAllowed(user: any) {
  return (
    hasPermission(user as any, "checklist.view_all") ||
    hasAnyRole(user as any, ["admin", "manager", "supervisor"])
  );
}

type ChecklistRow = {
  _id: string;
  tripId: string;
  templateId: string;
  submittedAt: string;
  badCount: number;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
};

function normalizeApprovalStatus(value: unknown): "PENDING" | "APPROVED" | "REJECTED" {
  const text = String(value ?? "").trim().toUpperCase();
  if (["APPROVED", "APROBADO", "OK", "PASS"].includes(text)) return "APPROVED";
  if (["REJECTED", "RECHAZADO", "NO_APROBADO", "NO APROBADO", "DENIED", "FAIL"].includes(text)) {
    return "REJECTED";
  }
  return "PENDING";
}

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  if (!isAllowed(auth.user)) return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });

  const url = new URL(req.url);
  const date = normalizeDateKey(url.searchParams.get("date")) || todayKey();

  const trips = await Trip.find({ tripDateKey: date })
    .sort({ dominio: 1, solicitudAt: 1, createdAt: 1 })
    .select("_id dominio tipo tripDateKey")
    .lean();

  const templateDocs = await ChecklistTemplate.find({ isActive: true })
    .sort({ templateId: 1, version: -1 })
    .select("templateId title shortTitle version")
    .lean();

  const templateMap = new Map<string, { title: string; shortTitle: string; version: number }>();
  for (const t of templateDocs as any[]) {
    const templateId = String(t.templateId || "").trim();
    if (!templateId || templateMap.has(templateId)) continue;
    templateMap.set(templateId, {
      title: String(t.title || templateId),
      shortTitle: String(t.shortTitle || ""),
      version: Number(t.version || 1),
    });
  }
  const expectedTemplateIds = Array.from(templateMap.keys());

  const tripIdSet = new Set((trips as any[]).map((t) => String(t._id)));
  const tripByPlate = new Map<string, string>();
  for (const trip of trips as any[]) {
    const plate = normalizePlate(trip.dominio);
    if (!plate || tripByPlate.has(plate)) continue;
    tripByPlate.set(plate, String(trip._id));
  }

  const { start, end } = dateRangeForKey(date);
  const checklistRows = expectedTemplateIds.length
    ? ((await Checklist.find({
        submittedAt: { $gte: start, $lte: end },
        templateId: { $in: expectedTemplateIds },
      })
        .sort({ submittedAt: -1, createdAt: -1 })
        .select("_id templateId submittedAt data")
        .lean()) as any[])
    : [];

  const latestByTripTemplate = new Map<string, ChecklistRow>();
  for (const c of checklistRows) {
    const templateId = String(c?.templateId || c?.data?.assignment?.assignedTemplateId || "").trim();
    if (!templateId || !templateMap.has(templateId)) continue;

    const explicitTripId = String(c?.data?.assignment?.tripId || "").trim();
    const inferredTripId = tripIdSet.has(explicitTripId)
      ? explicitTripId
      : tripByPlate.get(checklistPlate(c)) || "";
    if (!inferredTripId) continue;

    const key = `${inferredTripId}::${templateId}`;
    if (latestByTripTemplate.has(key)) continue;

    latestByTripTemplate.set(key, {
      _id: String(c._id),
      tripId: inferredTripId,
      templateId,
      submittedAt: String(c.submittedAt || ""),
      badCount: Number(c?.data?.meta?.badCount || 0),
      approvalStatus: normalizeApprovalStatus(
        c?.approvalStatus ??
          c?.data?.approvalStatus ??
          c?.data?.approval?.status ??
          c?.reviewStatus ??
          c?.data?.reviewStatus ??
          c?.data?.review?.status,
      ),
    });
  }

  const items = (trips as any[]).map((trip) => {
    let completed = 0;
    let observed = 0;
    let pending = 0;
    let unapproved = 0;
    let approved = 0;

    const checks = expectedTemplateIds.map((templateId) => {
      const row = latestByTripTemplate.get(`${String(trip._id)}::${templateId}`);
      if (!row) {
        pending += 1;
        return {
          templateId,
          templateTitle: templateMap.get(templateId)?.title || templateId,
          state: "PENDING",
          badCount: 0,
          approvalStatus: "PENDING",
        };
      }

      completed += 1;
      const hasObs = row.badCount > 0;
      if (hasObs) observed += 1;
      const isApproved = row.approvalStatus === "APPROVED";
      if (!isApproved) unapproved += 1;
      else approved += 1;
      return {
        templateId,
        templateTitle: templateMap.get(templateId)?.title || templateId,
        state: hasObs ? "OBSERVED" : "OK",
        badCount: row.badCount,
        checklistId: row._id,
        approvalStatus: row.approvalStatus,
      };
    });

    let status: "RED" | "YELLOW" | "GREEN" | "NONE" = "NONE";
    if (expectedTemplateIds.length > 0) {
      status = pending > 0 || unapproved > 0 ? "RED" : "GREEN";
    }

    return {
      tripId: String(trip._id),
      dominio: String(trip.dominio || "").trim().toUpperCase(),
      tipo: String(trip.tipo || "").trim(),
      tripDateKey: String(trip.tripDateKey || ""),
      expectedCount: expectedTemplateIds.length,
      completedCount: completed,
      approvedCount: approved,
      pendingApprovalCount: unapproved,
      observedCount: observed,
      pendingCount: pending,
      status,
      checks,
    };
  });

  const summary = {
    totalTrips: items.length,
    red: items.filter((x) => x.status === "RED").length,
    yellow: 0,
    green: items.filter((x) => x.status === "GREEN").length,
    none: items.filter((x) => x.status === "NONE").length,
  };

  return Response.json({ ok: true, date, summary, items });
}
