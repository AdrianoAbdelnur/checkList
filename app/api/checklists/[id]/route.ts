import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  await connectToDatabase();
  const { id } = await ctx.params;

  const item = await Checklist.findById(id).lean();
  if (!item) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });

  return Response.json({ ok: true, item });
}

export async function PATCH(req: Request, ctx: Ctx) {
  await connectToDatabase();
  const { id } = await ctx.params;

  const doc = await Checklist.findById(id);
  if (!doc) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  if (doc.status !== "DRAFT") return Response.json({ ok: false, message: "Checklist bloqueado" }, { status: 409 });

  const patch = await req.json();

  if (patch?.data !== undefined) doc.data = patch.data;
  await doc.save();

  return Response.json({ ok: true, item: doc.toObject() });
}

export async function DELETE(_: Request, ctx: Ctx) {
  await connectToDatabase();
  const { id } = await ctx.params;

  const deleted = await Checklist.findByIdAndDelete(id).lean();
  if (!deleted) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });

  return Response.json({ ok: true });
}
