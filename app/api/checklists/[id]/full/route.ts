import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  await connectToDatabase();
  const { id } = await ctx.params;

  const checklist = await Checklist.findById(id)
    .populate("inspectorId", "name email")
    .lean();

  if (!checklist) {
    return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  }

  const template = await ChecklistTemplate.findOne({
    templateId: checklist.templateId,
    version: checklist.templateVersion,
  }).lean();

  if (!template) {
    return Response.json({ ok: false, message: "Template/version no encontrada" }, { status: 404 });
  }

  return Response.json({ ok: true, checklist, template });
}
