import crypto from "crypto";
import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import ChecklistTemplate from "@/models/ChecklistTemplate";
import Trip from "@/models/Trip";
import { requireUser } from "@/lib/auth/requireUser";
import { listChecklistsForInspector } from "@/lib/checklists";
import { hasPermission } from "@/lib/roles";
import { actorFromUser, cloneForAudit, logAuditEvent } from "@/lib/audit";
import { canUserAccessTemplate } from "@/lib/templates";

function normalizePlate(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

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

function parseDateKeyToDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mm - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function tenantScopeConditions(tenantId: string) {
  return [
    { tenantId },
    { tenantId: { $exists: false } },
    { tenantId: null },
    { tenantId: "" },
  ];
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

function extractPlate(body: any): string {
  const subject =
    body?.data?.subject?.plate ??
    body?.data?.subject?.patente ??
    body?.data?.subject?.dominio ??
    body?.data?.subject?.vehicle_domain ??
    body?.data?.subject?.vehicleDomain;
  const values =
    body?.data?.values?.vehicle_domain?.value ??
    body?.data?.values?.vehicleDomain?.value ??
    body?.data?.values?.pre_plate?.value ??
    body?.data?.values?.plate?.value ??
    body?.data?.values?.patente?.value ??
    body?.data?.values?.dominio?.value ??
    body?.data?.values?.vehicle_domain ??
    body?.data?.values?.vehicleDomain ??
    body?.data?.values?.pre_plate ??
    body?.data?.values?.plate ??
    body?.data?.values?.patente ??
    body?.data?.values?.dominio;
  const meta =
    body?.data?.meta?.vehicle_domain ??
    body?.data?.meta?.vehicleDomain ??
    body?.data?.meta?.plate ??
    body?.data?.meta?.patente ??
    body?.data?.meta?.dominio;
  return normalizePlate(subject ?? values ?? meta ?? "");
}

function extractTripDateKey(body: any): string {
  const assignment = body?.data?.assignment?.tripDateKey;
  const values = body?.data?.values?.trip_date?.value ?? body?.data?.values?.trip_date;
  const meta = body?.data?.meta?.tripDateKey;
  return normalizeDateKey(assignment ?? values ?? meta ?? "") || todayKey();
}

async function resolveTripForChecklist({
  plate,
  tripDateKey,
  assignment,
  authUser,
}: {
  plate: string;
  tripDateKey: string;
  assignment: any;
  authUser: any;
}) {
  if (!plate || !tripDateKey) return null;

  const tripDate = parseDateKeyToDate(tripDateKey);
  if (!tripDate) return null;

  const existingTrip = await Trip.findOne({
    tripDateKey,
    dominio: plate,
  })
    .sort({ solicitudAt: 1, createdAt: 1 })
    .lean();

  if (existingTrip) return existingTrip;

  const tripType = String(assignment?.tripType || "Viaje auto-generado").trim();
  const uniqueKey = crypto
    .createHash("sha1")
    .update(`${tripDateKey}|${plate}|AUTO_CHECKLIST`)
    .digest("hex");

  const trip = await Trip.findOneAndUpdate(
    { uniqueKey },
    {
      $setOnInsert: {
        uniqueKey,
        tripDateKey,
        tripDate,
        solicitudRaw: "",
        tipo: tripType,
        dominio: plate,
        viajeRaw: tripDateKey,
        sourceFile: "auto-checklist",
        importBatchId: "",
        uploadedBy: {
          id: String(authUser?._id || ""),
          email: String(authUser?.email || ""),
          firstName: String(authUser?.firstName || ""),
          lastName: String(authUser?.lastName || ""),
          role: String(authUser?.role || ""),
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  if (trip) return trip;

  return Trip.findOne({
    $or: [{ uniqueKey }, { tripDateKey, dominio: plate }],
  }).lean();
}

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId");
  const status = url.searchParams.get("status");
  const plate = url.searchParams.get("plate");

  const items = await listChecklistsForInspector({
    user: auth.user as any,
    inspectorId: auth.user._id,
    includeAll: hasPermission(auth.user as any, "checklist.view_all"),
    templateId,
    status,
    plate,
  });
  return Response.json({ ok: true, items });
}

export async function POST(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json();

  const templateId = String(body?.templateId ?? "");
  if (!templateId) {
    return Response.json({ ok: false, message: "templateId requerido" }, { status: 400 });
  }

  let templateVersion = body?.templateVersion ? Number(body.templateVersion) : null;

  if (!templateVersion) {
    const last = await ChecklistTemplate.findOne({ templateId, isActive: true })
      .sort({ version: -1 })
      .lean();

    if (!last) {
      return Response.json({ ok: false, message: "Template no encontrado" }, { status: 404 });
    }

    if (!canUserAccessTemplate(auth.user as any, last)) {
      return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
    }

    templateVersion = last.version;
  } else {
    const exists = await ChecklistTemplate.findOne({ templateId, version: templateVersion }).lean();
    if (!exists) {
      return Response.json({ ok: false, message: "Template/version no existe" }, { status: 404 });
    }
    if (!canUserAccessTemplate(auth.user as any, exists)) {
      return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
    }
  }

  const inspectorSnapshot = {
    id: auth.user._id,
    email: auth.user.email,
    firstName: auth.user.firstName,
    lastName: auth.user.lastName,
    role: auth.user.role,
  };

  const plate = extractPlate(body);
  const tripDateKey = extractTripDateKey(body);
  if (plate) {
    const tenantId = String((auth.user as any).tenantId || "general").trim() || "general";
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
        buildTripDateFilter(tripDateKey),
        {
          $or: tenantScopeConditions(tenantId),
        },
      ],
    })
      .select("_id")
      .lean();

    if (existing) {
      return Response.json(
        { ok: false, message: "Este check ya está realizado para este vehículo el día de hoy." },
        { status: 409 },
      );
    }
  }

  const resolvedAssignment = { ...(body?.data?.assignment ?? {}) };
  const resolvedMeta = {
    ...(body?.data?.meta ?? {}),
    ...(tripDateKey ? { tripDateKey } : {}),
  };

  if (plate && tripDateKey) {
    const selectedTripMatchesAssignment =
      !!String(resolvedAssignment.tripId || "").trim() &&
      String(resolvedAssignment.tripDateKey || "").trim() === tripDateKey;

    const selectedTrip = selectedTripMatchesAssignment
      ? await Trip.findById(String(resolvedAssignment.tripId)).lean()
      : null;

    const validSelectedTrip =
      selectedTrip &&
      String((selectedTrip as any).tripDateKey || "").trim() === tripDateKey &&
      normalizePlate((selectedTrip as any).dominio) === plate
        ? selectedTrip
        : null;

    const trip =
      validSelectedTrip ??
      (await resolveTripForChecklist({
        plate,
        tripDateKey,
        assignment: resolvedAssignment,
        authUser: auth.user,
      }));

    if (trip) {
      resolvedAssignment.tripId = String((trip as any)._id || "");
      resolvedAssignment.tripDateKey = tripDateKey;
      resolvedAssignment.tripType = String(
        resolvedAssignment.tripType || (trip as any).tipo || "",
      ).trim();
    } else {
      resolvedAssignment.tripId = "";
      resolvedAssignment.tripDateKey = tripDateKey;
    }
  }

  const created = await Checklist.create({
    templateId,
    templateVersion,
    tenantId: String((auth.user as any).tenantId || "general").trim() || "general",
    inspectorId: auth.user._id,
    inspectorSnapshot,
    data: {
      ...(body?.data ?? {}),
      meta: resolvedMeta,
      assignment: resolvedAssignment,
    },
    status: "SUBMITTED",
    submittedAt: new Date(),
  });

  if (plate && tripDateKey && !String(created?.data?.assignment?.tripId || "").trim()) {
    const trip = await resolveTripForChecklist({
      plate,
      tripDateKey,
      assignment: created?.data?.assignment ?? resolvedAssignment,
      authUser: auth.user,
    });

    if (trip) {
      created.data = created.data ?? {};
      created.data.assignment = {
        ...(created.data.assignment ?? {}),
        tripId: String((trip as any)._id || ""),
        tripDateKey,
        tripType: String(
          created?.data?.assignment?.tripType || (trip as any).tipo || "",
        ).trim(),
      };
      await created.save();
    }
  }

  await logAuditEvent({
    req,
    action: "check.created",
    entityType: "checklist",
    entityId: String(created._id),
    actor: actorFromUser(auth.user),
    before: null,
    after: cloneForAudit({
      templateId: created.templateId,
      templateVersion: created.templateVersion,
      tenantId: created.tenantId,
      inspectorId: created.inspectorId,
      status: created.status,
      submittedAt: created.submittedAt,
      data: created.data,
    }),
  });

  return Response.json({ ok: true, item: created }, { status: 201 });
}
