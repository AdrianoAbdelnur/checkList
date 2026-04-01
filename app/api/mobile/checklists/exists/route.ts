import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import { requireUser } from "@/lib/auth/requireUser";

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

  const { start, end } = dateRangeForKey(date);

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
    .sort({ submittedAt: -1, createdAt: -1 })
    .select("_id submittedAt")
    .lean();

  return Response.json({
    ok: true,
    exists: !!existing,
    item: existing
      ? {
          id: String(existing._id),
          submittedAt: String((existing as any).submittedAt || ""),
        }
      : null,
  });
}

