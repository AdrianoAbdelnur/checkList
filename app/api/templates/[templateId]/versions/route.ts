import { createTemplateVersion, listTemplateVersions } from "@/lib/templates";
import { NextRequest } from "next/server";
import { requireRolesSession } from "@/lib/server/auth-next";

type Ctx = { params: Promise<{ templateId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { templateId } = await ctx.params;

  const items = await listTemplateVersions(templateId);
  return Response.json({ ok: true, items });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireRolesSession(req, ["admin", "reviewer"]);
  if (!auth.ok) return Response.json({ ok: false, message: auth.error }, { status: auth.status });

  const { templateId } = await ctx.params;
  const body = await req.json();

  const id = String(body?.id ?? templateId).trim();
  const title = String(body?.title ?? "");
  const sections = body?.sections;
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!title) return Response.json({ ok: false, message: "title requerido" }, { status: 400 });
  if (!Array.isArray(sections) || sections.length === 0) {
    return Response.json({ ok: false, message: "sections debe ser array no vacio" }, { status: 400 });
  }

  const created = await createTemplateVersion({ id, templateId, title, sections, isActive });

  return Response.json({ ok: true, item: created }, { status: 201 });
}
