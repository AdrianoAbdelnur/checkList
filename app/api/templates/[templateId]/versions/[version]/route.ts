import { getTemplateVersion } from "@/lib/templates";

type Ctx = { params: Promise<{ templateId: string; version: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { templateId, version } = await ctx.params;

  const v = Number(version);
  if (!Number.isFinite(v)) return Response.json({ ok: false, message: "version inválida" }, { status: 400 });

  const item = await getTemplateVersion(templateId, v);
  if (!item) return Response.json({ ok: false, message: "Versión no encontrada" }, { status: 404 });

  return Response.json({ ok: true, item });
}
