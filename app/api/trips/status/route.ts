import { connectToDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { hasAnyRole, hasPermission } from "@/lib/roles";
import Trip from "@/models/Trip";
import Checklist from "@/models/Checklist";

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

function isAllowed(user: any) {
  return (
    hasPermission(user as any, "checklist.view_all") ||
    hasAnyRole(user as any, ["admin", "supervisor", "reviewer"])
  );
}

function getAssignedTemplates(trip: any): string[] {
  const fromCheckAssignments =
    trip?.checkAssignments && typeof trip.checkAssignments === "object"
      ? Object.keys(trip.checkAssignments).map((x) => String(x || "").trim()).filter(Boolean)
      : [];
  if (fromCheckAssignments.length > 0) return fromCheckAssignments;

  const fromInspectorAssignments = Array.isArray(trip?.assignedInspectorAssignments)
    ? trip.assignedInspectorAssignments
        .map((x: any) => String(x?.templateId || "").trim())
        .filter(Boolean)
    : [];
  if (fromInspectorAssignments.length > 0) return Array.from(new Set(fromInspectorAssignments));

  return Array.isArray(trip?.assignedTemplateIds)
    ? Array.from(
        new Set(trip.assignedTemplateIds.map((x: unknown) => String(x || "").trim()).filter(Boolean)),
      )
    : [];
}

type ChecklistRow = {
  _id: string;
  tripId: string;
  templateId: string;
  createdAt: string;
  badCount: number;
};

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  if (!isAllowed(auth.user)) return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });

  const url = new URL(req.url);
  const date = normalizeDateKey(url.searchParams.get("date")) || todayKey();

  const trips = await Trip.find({ tripDateKey: date })
    .sort({ dominio: 1, solicitudAt: 1, createdAt: 1 })
    .select("_id dominio tipo tripDateKey assignedTemplateIds assignedInspectorAssignments checkAssignments")
    .lean();

  const tripIds = (trips as any[]).map((t) => String(t._id));
  const checklistRows = tripIds.length
    ? ((await Checklist.find({
        "data.assignment.tripId": { $in: tripIds },
      })
        .sort({ createdAt: -1 })
        .select("_id templateId createdAt data")
        .lean()) as any[])
    : [];

  const latestByTripTemplate = new Map<string, ChecklistRow>();
  for (const c of checklistRows) {
    const tripId = String(c?.data?.assignment?.tripId || "").trim();
    const templateId = String(c?.templateId || c?.data?.assignment?.assignedTemplateId || "").trim();
    if (!tripId || !templateId) continue;

    const key = `${tripId}::${templateId}`;
    if (latestByTripTemplate.has(key)) continue;

    latestByTripTemplate.set(key, {
      _id: String(c._id),
      tripId,
      templateId,
      createdAt: String(c.createdAt || ""),
      badCount: Number(c?.data?.meta?.badCount || 0),
    });
  }

  const items = (trips as any[]).map((trip) => {
    const expectedTemplates = getAssignedTemplates(trip);
    let completed = 0;
    let observed = 0;
    let pending = 0;

    const checks = expectedTemplates.map((templateId) => {
      const key = `${String(trip._id)}::${templateId}`;
      const row = latestByTripTemplate.get(key);
      if (!row) {
        pending += 1;
        return {
          templateId,
          state: "PENDING",
          badCount: 0,
        };
      }

      completed += 1;
      const hasObs = row.badCount > 0;
      if (hasObs) observed += 1;
      return {
        templateId,
        state: hasObs ? "OBSERVED" : "OK",
        badCount: row.badCount,
        checklistId: row._id,
      };
    });

    let status: "RED" | "YELLOW" | "GREEN" | "NONE" = "NONE";
    if (expectedTemplates.length > 0) {
      status = pending > 0 ? "RED" : observed > 0 ? "YELLOW" : "GREEN";
    }

    return {
      tripId: String(trip._id),
      dominio: String(trip.dominio || "").trim().toUpperCase(),
      tipo: String(trip.tipo || "").trim(),
      tripDateKey: String(trip.tripDateKey || ""),
      expectedCount: expectedTemplates.length,
      completedCount: completed,
      observedCount: observed,
      pendingCount: pending,
      status,
      checks,
    };
  });

  const summary = {
    totalTrips: items.length,
    red: items.filter((x) => x.status === "RED").length,
    yellow: items.filter((x) => x.status === "YELLOW").length,
    green: items.filter((x) => x.status === "GREEN").length,
    none: items.filter((x) => x.status === "NONE").length,
  };

  return Response.json({ ok: true, date, summary, items });
}

