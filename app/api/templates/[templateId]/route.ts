import { getActiveTemplateByTemplateId } from "@/lib/templates";

type Ctx = { params: Promise<{ templateId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { templateId } = await ctx.params;

  const item = await getActiveTemplateByTemplateId(templateId);

  if (!item) return Response.json({ ok: false, message: "Template no encontrado" }, { status: 404 });
  return Response.json({ ok: true, item });
}

