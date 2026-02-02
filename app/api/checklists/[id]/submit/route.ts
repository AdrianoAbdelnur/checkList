import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_: Request, ctx: Ctx) {
  await connectToDatabase();
  const { id } = await ctx.params;

  const doc = await Checklist.findById(id);
  if (!doc) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  if (doc.status !== "DRAFT") return Response.json({ ok: false, message: "Ya enviado" }, { status: 409 });

  doc.status = "SUBMITTED";
  doc.submittedAt = new Date();
  await doc.save();

  return Response.json({ ok: true, item: doc.toObject() });
}
