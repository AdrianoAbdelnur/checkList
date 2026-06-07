import crypto from "crypto";
import { connectToDatabase } from "@/lib/db";
import Trip from "@/models/Trip";
import { requireUser } from "@/lib/auth/requireUser";

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

export async function POST(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const plate = normalizePlate(body?.plate);
  const tripDateKey = normalizeDateKey(body?.tripDateKey);
  const tripType = String(body?.tripType || "Viaje auto-generado").trim();

  if (!plate) {
    return Response.json({ ok: false, message: "plate requerido" }, { status: 400 });
  }
  if (!tripDateKey) {
    return Response.json({ ok: false, message: "tripDateKey requerido" }, { status: 400 });
  }

  const tripDate = parseDateKeyToDate(tripDateKey);
  if (!tripDate) {
    return Response.json({ ok: false, message: "tripDateKey invalido" }, { status: 400 });
  }

  const existingTrip = await Trip.findOne({
    tripDateKey,
    dominio: plate,
  })
    .sort({ solicitudAt: 1, createdAt: 1 })
    .lean();

  if (existingTrip) {
    return Response.json({
      ok: true,
      assignment: {
        tripId: String((existingTrip as any)._id || ""),
        tripDateKey,
        tripType: String((existingTrip as any).tipo || tripType),
      },
    });
  }

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
          id: String((auth.user as any)?._id || ""),
          email: String((auth.user as any)?.email || ""),
          firstName: String((auth.user as any)?.firstName || ""),
          lastName: String((auth.user as any)?.lastName || ""),
          role: String((auth.user as any)?.role || ""),
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return Response.json({
    ok: true,
    assignment: trip
      ? {
          tripId: String((trip as any)._id || ""),
          tripDateKey,
          tripType: String((trip as any).tipo || tripType),
        }
      : null,
  });
}
