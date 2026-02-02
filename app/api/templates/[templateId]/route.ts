import { connectToDatabase } from "@/lib/db";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type Ctx = { params: Promise<{ templateId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  await connectToDatabase();
  const { templateId } = await ctx.params;

  const item = await ChecklistTemplate.findOne({ templateId, isActive: true })
    .sort({ version: -1 })
    .lean();

  if (!item) return Response.json({ ok: false, message: "Template no encontrado" }, { status: 404 });
  return Response.json({ ok: true, item });
}

