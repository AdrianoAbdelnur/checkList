import { connectToDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { hasAnyRole, hasPermission } from "@/lib/roles";
import Trip from "@/models/Trip";
import { actorFromUser, cloneForAudit, logAuditEvent } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

function isAllowed(user: any) {
  return (
    hasPermission(user as any, "checklist.view_all") ||
    hasAnyRole(user as any, ["admin", "manager", "supervisor"])
  );
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
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return null;
  return date;
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

export async function PATCH(req: Request, ctx: Ctx) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAllowed(auth.user)) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return Response.json({ ok: false, message: "id requerido" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const update: any = {};

  if (body?.solicitudRaw !== undefined) update.solicitudRaw = String(body.solicitudRaw || "").trim();
  if (body?.tipo !== undefined) update.tipo = String(body.tipo || "").trim();
  if (body?.dominio !== undefined) update.dominio = String(body.dominio || "").trim().toUpperCase();
  if (body?.viajeRaw !== undefined) update.viajeRaw = String(body.viajeRaw || "").trim();

  if (body?.viajeDateKey !== undefined) {
    const dateKey = normalizeDateKey(body.viajeDateKey);
    const date = parseDateKeyToDate(dateKey);
    if (!dateKey || !date) {
      return Response.json({ ok: false, message: "viajeDateKey invalido" }, { status: 400 });
    }
    update.tripDateKey = dateKey;
    update.tripDate = date;
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ ok: false, message: "Nada para actualizar" }, { status: 400 });
  }

  const doc = await Trip.findById(id);
  if (!doc) return Response.json({ ok: false, message: "Viaje no encontrado" }, { status: 404 });

  const before = toTripAuditSnapshot(doc.toObject());
  doc.set(update);
  await doc.save();
  const after = toTripAuditSnapshot(doc.toObject());

  await logAuditEvent({
    req,
    action: "trip.updated",
    entityType: "trip",
    entityId: String(doc._id),
    actor: actorFromUser(auth.user),
    before,
    after,
    meta: { reason: "manual_patch" },
  });

  const item = doc.toObject();

  return Response.json({ ok: true, item });
}

export async function DELETE(req: Request, ctx: Ctx) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAllowed(auth.user)) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return Response.json({ ok: false, message: "id requerido" }, { status: 400 });

  const deleted = await Trip.findByIdAndDelete(id).lean();
  if (!deleted) return Response.json({ ok: false, message: "Viaje no encontrado" }, { status: 404 });

  await logAuditEvent({
    req,
    action: "trip.deleted",
    entityType: "trip",
    entityId: String((deleted as any)._id),
    actor: actorFromUser(auth.user),
    before: toTripAuditSnapshot(deleted),
    after: null,
  });

  return Response.json({ ok: true });
}

