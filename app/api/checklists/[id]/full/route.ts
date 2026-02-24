import { getChecklistWithTemplateById } from "@/lib/checklists";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await getChecklistWithTemplateById(id);
  if (!result?.checklist) {
    return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  }
  if (!result.template) {
    return Response.json({ ok: false, message: "Template/version no encontrada" }, { status: 404 });
  }

  return Response.json({ ok: true, checklist: result.checklist, template: result.template });
}
