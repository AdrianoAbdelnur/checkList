import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import ChecklistTemplate from "@/models/ChecklistTemplate";
import { requireUser } from "@/lib/auth/requireUser";
import { listChecklistsForInspector } from "@/lib/checklists";
import { hasPermission } from "@/lib/roles";

function normalizePlate(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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

function extractPlate(body: any): string {
  const subject =
    body?.data?.subject?.plate ??
    body?.data?.subject?.patente ??
    body?.data?.subject?.dominio ??
    body?.data?.subject?.vehicle_domain ??
    body?.data?.subject?.vehicleDomain;
  const values =
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

  const canViewAll = hasPermission(auth.user as any, "checklist.view_all");
  const isInspector = hasPermission(auth.user as any, "checklist.create") && !canViewAll;

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

    templateVersion = last.version;
  } else {
    const exists = await ChecklistTemplate.findOne({ templateId, version: templateVersion }).lean();
    if (!exists) {
      return Response.json({ ok: false, message: "Template/version no existe" }, { status: 404 });
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
  if (plate) {
    const dateKey = todayKey();
    const { start, end } = dateRangeForKey(dateKey);
    const existing = await Checklist.findOne({
      templateId,
      submittedAt: { $gte: start, $lte: end },
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

  const created = await Checklist.create({
    templateId,
    templateVersion,
    inspectorId: auth.user._id,
    inspectorSnapshot,
    data: body?.data ?? {},
    status: "SUBMITTED",
    submittedAt: new Date(),
  });

  return Response.json({ ok: true, item: created }, { status: 201 });
}



