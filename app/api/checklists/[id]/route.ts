import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import { requireUser } from "@/lib/auth/requireUser";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  await connectToDatabase();
  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await ctx.params;

  const item = await Checklist.findById(id).lean();
  if (!item) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  const canViewAll = hasPermission(auth.user as any, "checklist.view_all");
  if (!canViewAll && String(item.inspectorId) !== String(auth.user._id)) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }

  return Response.json({ ok: true, item });
}

export async function PATCH(req: Request, ctx: Ctx) {
  await connectToDatabase();
  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await ctx.params;

  const doc = await Checklist.findById(id);
  if (!doc) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  const canViewAll = hasPermission(auth.user as any, "checklist.view_all");
  if (!canViewAll && String(doc.inspectorId) !== String(auth.user._id)) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }
  if (doc.status !== "DRAFT") return Response.json({ ok: false, message: "Checklist bloqueado" }, { status: 409 });

  const patch = await req.json();

  if (patch?.data !== undefined) doc.data = patch.data;
  await doc.save();

  return Response.json({ ok: true, item: doc.toObject() });
}

export async function DELETE(req: Request, ctx: Ctx) {
  await connectToDatabase();
  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!hasPermission(auth.user as any, "user.manage")) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const deleted = await Checklist.findByIdAndDelete(id).lean();
  if (!deleted) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });

  return Response.json({ ok: true });
}

