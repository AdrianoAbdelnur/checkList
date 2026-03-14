import { listLatestActiveTemplates } from "@/lib/templates";
import { requireUser } from "@/lib/auth/requireUser";
import { connectToDatabase } from "@/lib/db";
import { hasPermission } from "@/lib/roles";

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const items = await listLatestActiveTemplates();

  const canSeeAll =
    hasPermission(auth.user as any, "template.manage") || hasPermission(auth.user as any, "checklist.view_all");

  if (canSeeAll) {
    return Response.json({ ok: true, items });
  }

  const assignedTemplateIds = Array.isArray((auth.user as any)?.assignedTemplateIds)
    ? (auth.user as any).assignedTemplateIds.map((x: unknown) => String(x || "").trim()).filter(Boolean)
    : [];

  if (assignedTemplateIds.length === 0) {
    return Response.json({ ok: true, items: [] });
  }

  const allowed = new Set(assignedTemplateIds);
  const filtered = (Array.isArray(items) ? items : []).filter((item: any) =>
    allowed.has(String(item?.templateId || "").trim()),
  );

  return Response.json({ ok: true, items: filtered });
}
