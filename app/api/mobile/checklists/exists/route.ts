import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import Trip from "@/models/Trip";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveTemplateByTemplateIdForUser } from "@/lib/templates";

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

function addDaysToKey(key: string, days: number) {
  const base = new Date(`${key}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateRangeForKey(key: string) {
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(`${key}T23:59:59.999Z`);
  return { start, end };
}

function buildTripDateFilter(dateKey: string) {
  const { start, end } = dateRangeForKey(dateKey);
  return {
    $or: [
      { "data.assignment.tripDateKey": dateKey },
      { "data.values.trip_date.value": dateKey },
      { "data.meta.tripDateKey": dateKey },
      { submittedAt: { $gte: start, $lte: end } },
    ],
  };
}

function tenantScopeConditions(tenantId: string) {
  return [
    { tenantId },
    { tenantId: { $exists: false } },
    { tenantId: null },
    { tenantId: "" },
  ];
}

function normalizePlate(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(req.url);
  const templateId = String(url.searchParams.get("templateId") || "").trim();
  const plate = normalizePlate(url.searchParams.get("plate"));
  const date = normalizeDateKey(url.searchParams.get("date")) || todayKey();

  if (!templateId) {
    return Response.json({ ok: false, message: "templateId requerido" }, { status: 400 });
  }
  if (!plate) {
    return Response.json({ ok: false, message: "plate requerido" }, { status: 400 });
  }

  const template = await getActiveTemplateByTemplateIdForUser(auth.user as any, templateId);
  if (template === false) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }
  if (!template) {
    return Response.json({ ok: false, message: "Template no encontrado" }, { status: 404 });
  }

  const tenantId = String((auth.user as any).tenantId || "general").trim() || "general";
  const candidateDateKeys = [date, addDaysToKey(date, 1), addDaysToKey(date, 2)];
  const trips = await Trip.find({ tripDateKey: { $in: candidateDateKeys } })
    .sort({ tripDateKey: 1, solicitudAt: 1, createdAt: 1 })
    .select("_id dominio tipo tripDateKey solicitudAt createdAt")
    .lean();
  const matchingTrips = (trips as any[]).filter(
    (t) => normalizePlate(t?.dominio) === plate,
  );
  const selectedTrip = matchingTrips[0] ?? null;
  const plateFound = !!selectedTrip;
  const checklistTripDateKey = String(selectedTrip?.tripDateKey || date);

  if (!plateFound) {
    return Response.json({
      ok: true,
      exists: false,
      plateFound: false,
      message: "La patente no existe en la lista de hoy ni en los proximos 2 dias.",
      item: null,
      assignment: null,
    });
  }

  const existing = await Checklist.findOne({
    templateId,
    $and: [
      {
        $or: [
          { "data.subject.plate": plate },
          { "data.subject.patente": plate },
          { "data.subject.dominio": plate },
          { "data.subject.vehicle_domain": plate },
          { "data.subject.vehicleDomain": plate },
          { "data.values.pre_plate": plate },
          { "data.values.plate": plate },
          { "data.values.patente": plate },
          { "data.values.dominio": plate },
          { "data.values.vehicle_domain": plate },
          { "data.values.vehicleDomain": plate },
          { "data.meta.plate": plate },
          { "data.meta.patente": plate },
          { "data.meta.dominio": plate },
          { "data.meta.vehicle_domain": plate },
          { "data.meta.vehicleDomain": plate },
        ],
      },
      buildTripDateFilter(checklistTripDateKey),
      {
        $or: tenantScopeConditions(tenantId),
      },
    ],
  })
    .sort({ submittedAt: -1, createdAt: -1 })
    .select("_id submittedAt")
    .lean();

  return Response.json({
    ok: true,
    exists: !!existing,
    plateFound: true,
    message: existing
      ? "Este check ya esta realizado para este vehiculo en la fecha de viaje seleccionada."
      : null,
    assignment: selectedTrip
      ? {
          tripId: String(selectedTrip._id),
          tripDateKey: String(selectedTrip.tripDateKey || ""),
          tripType: String(selectedTrip.tipo || ""),
        }
      : null,
    item: existing
      ? {
          id: String(existing._id),
          submittedAt: String((existing as any).submittedAt || ""),
        }
      : null,
  });
}
