import { deleteTemplateVersion } from "@/lib/templates";
import { NextRequest } from "next/server";
import { requireRolesSession } from "@/lib/server/auth-next";

type Ctx = { params: Promise<{ templateId: string; version: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireRolesSession(req, ["admin", "reviewer"]);
  if (!auth.ok) return Response.json({ ok: false, message: auth.error }, { status: auth.status });

  const { templateId, version } = await ctx.params;

  const v = Number(version);
  if (!Number.isFinite(v)) return Response.json({ ok: false, message: "version inválida" }, { status: 400 });

  const deleted = await deleteTemplateVersion(templateId, v);
  if (!deleted) return Response.json({ ok: false, message: "Versión no encontrada" }, { status: 404 });

  return Response.json({ ok: true });
}
