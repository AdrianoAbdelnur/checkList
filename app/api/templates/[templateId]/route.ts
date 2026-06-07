import { requireUser } from "@/lib/auth/requireUser";
import { getActiveTemplateByTemplateId, getActiveTemplateByTemplateIdForUser } from "@/lib/templates";

type Ctx = { params: Promise<{ templateId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { templateId } = await ctx.params;
  const result = await getActiveTemplateByTemplateIdForUser(auth.user as any, templateId);

  if (result === false) {
    const exists = await getActiveTemplateByTemplateId(templateId);
    if (exists) {
      return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
    }
  }

  if (!result) {
    return Response.json({ ok: false, message: "Template no encontrado" }, { status: 404 });
  }

  return Response.json({ ok: true, item: result });
}
