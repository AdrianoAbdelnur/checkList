import { connectToDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { hasPermission } from "@/lib/roles";
import { canAccessChecklist } from "@/lib/checklists";
import Checklist from "@/models/Checklist";
import AuditEvent from "@/models/AuditEvent";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  await connectToDatabase();
  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const item = await Checklist.findById(id).select("inspectorId tenantId").lean();
  if (!item) {
    return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  }

  const canViewAll = hasPermission(auth.user as any, "checklist.view_all");
  if (!canAccessChecklist(auth.user as any, item, canViewAll)) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }

  const events = await AuditEvent.find({ entityType: "checklist", entityId: id })
    .sort({ occurredAt: -1 })
    .lean();

  return Response.json({ ok: true, items: events });
}
