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

  const title = String(body?.title ?? "");
  const sections = body?.sections;
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!title) return Response.json({ ok: false, message: "title requerido" }, { status: 400 });
  if (!sections) return Response.json({ ok: false, message: "sections requerido" }, { status: 400 });

  const created = await createTemplateVersion({ templateId, title, sections, isActive });

  return Response.json({ ok: true, item: created }, { status: 201 });
}
