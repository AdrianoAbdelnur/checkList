import { connectToDatabase } from "@/lib/db";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type Ctx = { params: Promise<{ templateId: string; version: string }> };

export async function DELETE(_: Request, ctx: Ctx) {
  await connectToDatabase();
  const { templateId, version } = await ctx.params;

  const v = Number(version);
  if (!Number.isFinite(v)) return Response.json({ ok: false, message: "version inválida" }, { status: 400 });

  const deleted = await ChecklistTemplate.findOneAndDelete({ templateId, version: v }).lean();
  if (!deleted) return Response.json({ ok: false, message: "Versión no encontrada" }, { status: 404 });

  return Response.json({ ok: true });
}
