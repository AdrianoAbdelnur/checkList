import { getChecklistWithTemplateById } from "@/lib/checklists";
import { requireUser } from "@/lib/auth/requireUser";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const canViewAll = hasPermission(auth.user as any, "checklist.view_all");
  const result = await getChecklistWithTemplateById(id, auth.user as any, canViewAll);
  if (result === false) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }
  if (!result) {
    return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  }
  if (!result.template) {
    return Response.json({ ok: false, message: "Template/version no encontrada" }, { status: 404 });
  }

  return Response.json({ ok: true, checklist: result.checklist, template: result.template });
}

