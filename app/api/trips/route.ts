import crypto from "crypto";
import { connectToDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { hasAnyRole, hasPermission } from "@/lib/roles";
import Trip from "@/models/Trip";
import { actorFromUser, cloneForAudit, logAuditEvent } from "@/lib/audit";

type IncomingTrip = {
  solicitudRaw?: string;
  solicitudAtIso?: string | null;
  tipo?: string;
  dominio?: string;
  viajeRaw?: string;
  viajeDateKey?: string;
};

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

function normalizeTripRow(input: IncomingTrip) {
  const tripDateKey = normalizeDateKey(input.viajeDateKey);
  const tripDate = parseDateKeyToDate(tripDateKey);

  if (!tripDateKey || !tripDate) return null;

  const solicitudRaw = String(input.solicitudRaw ?? "").trim();
  const tipo = String(input.tipo ?? "").trim();
  const dominio = String(input.dominio ?? "").trim().toUpperCase();
  const viajeRaw = String(input.viajeRaw ?? "").trim();

  let solicitudAt: Date | undefined;
  const solicitudAtIso = String(input.solicitudAtIso ?? "").trim();
  if (solicitudAtIso) {
    const d = new Date(solicitudAtIso);
    if (!Number.isNaN(d.getTime())) solicitudAt = d;
  }

  if (!tipo && !dominio && !solicitudRaw && !viajeRaw) return null;

  const uniqueBase = [
    tripDateKey,
    dominio,
    tipo,
    solicitudRaw,
    solicitudAt?.toISOString() || "",
    viajeRaw,
  ]
    .map((x) => String(x || "").trim().toUpperCase())
    .join("|");

  return {
    tripDateKey,
    tripDate,
    solicitudRaw,
    solicitudAt,
    tipo,
    dominio,
    viajeRaw,
    uniqueKey: crypto.createHash("sha1").update(uniqueBase).digest("hex"),
  };
}

function isAllowed(user: any) {
  return (
    hasPermission(user as any, "checklist.view_all") ||
    hasAnyRole(user as any, ["admin", "manager", "supervisor"])
  );
}

function toTripAuditSnapshot(doc: any) {
  if (!doc) return null;
  return cloneForAudit({
    id: String(doc._id),
    uniqueKey: String(doc.uniqueKey ?? ""),
    tripDateKey: String(doc.tripDateKey ?? ""),
    tripDate: doc.tripDate ?? null,
    solicitudRaw: String(doc.solicitudRaw ?? ""),
    solicitudAt: doc.solicitudAt ?? null,
    tipo: String(doc.tipo ?? ""),
    dominio: String(doc.dominio ?? ""),
    viajeRaw: String(doc.viajeRaw ?? ""),
    sourceFile: String(doc.sourceFile ?? ""),
    importBatchId: String(doc.importBatchId ?? ""),
    uploadedBy: doc.uploadedBy ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  });
}

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAllowed(auth.user)) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = normalizeDateKey(url.searchParams.get("date"));
  if (!date) {
    return Response.json({ ok: false, message: "date requerido (YYYY-MM-DD)" }, { status: 400 });
  }

  const items = await Trip.find({ tripDateKey: date })
    .sort({ solicitudAt: 1, createdAt: 1 })
    .lean();

  return Response.json({ ok: true, items });
}

export async function POST(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAllowed(auth.user)) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const sourceFile = String(body?.sourceFile || "").trim();

  if (!rows.length) {
    return Response.json({ ok: false, message: "rows requerido" }, { status: 400 });
  }

  const normalized = rows
    .map((r: IncomingTrip) => normalizeTripRow(r))
    .filter(Boolean) as ReturnType<typeof normalizeTripRow>[];

  if (!normalized.length) {
    return Response.json({ ok: false, message: "No hay viajes validos para guardar" }, { status: 400 });
  }

  const importBatchId = crypto.randomUUID();
  const uploadedBy = {
    id: String((auth.user as any)?._id || ""),
    email: String((auth.user as any)?.email || ""),
    firstName: String((auth.user as any)?.firstName || ""),
    lastName: String((auth.user as any)?.lastName || ""),
    role: String((auth.user as any)?.role || ""),
  };

  const ops = normalized.map((row) => ({
    updateOne: {
      filter: { uniqueKey: row!.uniqueKey },
      update: {
        $set: {
          tripDateKey: row!.tripDateKey,
          tripDate: row!.tripDate,
          solicitudRaw: row!.solicitudRaw,
          solicitudAt: row!.solicitudAt,
          tipo: row!.tipo,
          dominio: row!.dominio,
          viajeRaw: row!.viajeRaw,
          sourceFile,
          importBatchId,
          uploadedBy,
        },
        $setOnInsert: { uniqueKey: row!.uniqueKey },
      },
      upsert: true,
    },
  }));

  const uniqueKeys = normalized.map((row) => row!.uniqueKey);
  const existingTrips = await Trip.find({ uniqueKey: { $in: uniqueKeys } }).lean();
  const beforeByUniqueKey = new Map(existingTrips.map((trip) => [String((trip as any).uniqueKey), trip]));

  const result = await Trip.bulkWrite(ops, { ordered: false });
  const upserted = result.upsertedCount ?? 0;
  const modified = result.modifiedCount ?? 0;
  const actor = actorFromUser(auth.user);

  const savedTrips = await Trip.find({ uniqueKey: { $in: uniqueKeys } }).lean();
  const afterByUniqueKey = new Map(savedTrips.map((trip) => [String((trip as any).uniqueKey), trip]));

  const createdTripIds: string[] = [];
  const updatedTripIds: string[] = [];
  const unchangedTripIds: string[] = [];

  for (const row of normalized) {
    const uniqueKey = row!.uniqueKey;
    const beforeDoc = beforeByUniqueKey.get(uniqueKey);
    const afterDoc = afterByUniqueKey.get(uniqueKey);
    if (!afterDoc) continue;

    const beforeSnapshot = toTripAuditSnapshot(beforeDoc);
    const afterSnapshot = toTripAuditSnapshot(afterDoc);
    const isCreated = !beforeDoc;
    const hasChanges = JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot);

    const tripId = String((afterDoc as any)._id);
    if (isCreated) {
      createdTripIds.push(tripId);
      await logAuditEvent({
        req,
        action: "trip.created",
        entityType: "trip",
        entityId: tripId,
        actor,
        before: null,
        after: afterSnapshot,
        meta: { importBatchId, uniqueKey, sourceFile },
      });
      continue;
    }

    if (hasChanges) {
      updatedTripIds.push(tripId);
      await logAuditEvent({
        req,
        action: "trip.updated",
        entityType: "trip",
        entityId: tripId,
        actor,
        before: beforeSnapshot,
        after: afterSnapshot,
        meta: { importBatchId, uniqueKey, sourceFile, reason: "bulk_upload" },
      });
      continue;
    }

    unchangedTripIds.push(tripId);
  }

  await logAuditEvent({
    req,
    action: "trip.bulk_uploaded",
    entityType: "trip_batch",
    entityId: importBatchId,
    actor,
    before: null,
    after: {
      importBatchId,
      sourceFile,
      rowsReceived: rows.length,
      rowsNormalized: normalized.length,
      saved: normalized.length,
      upserted,
      modified,
      createdTripIds,
      updatedTripIds,
      unchangedTripIds,
    },
    meta: {
      uniqueKeys,
    },
  });

  return Response.json({
    ok: true,
    saved: normalized.length,
    upserted,
    modified,
    importBatchId,
  });
}

