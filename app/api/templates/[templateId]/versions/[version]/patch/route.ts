import { patchTemplateVersion } from "@/lib/templates";
import { NextRequest } from "next/server";
import { requireRolesSession } from "@/lib/server/auth-next";

type Ctx = { params: Promise<{ templateId: string; version: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireRolesSession(req, ["admin"]);
  if (!auth.ok) return Response.json({ ok: false, message: auth.error }, { status: auth.status });

  const { templateId, version } = await ctx.params;

  const v = Number(version);
  if (!Number.isFinite(v)) return Response.json({ ok: false, message: "version invÃ¡lida" }, { status: 400 });

  const rawPatch = (await req.json()) ?? {};
  const patch = { ...rawPatch };
  if ("accessMode" in patch) {
    patch.accessMode = String((patch as any).accessMode ?? "all").trim() === "selected" ? "selected" : "all";
  }
  if ("allowedTenantIds" in patch) {
    patch.allowedTenantIds = Array.isArray((patch as any).allowedTenantIds)
      ? (patch as any).allowedTenantIds.map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
      : [];
  }

  const item = await patchTemplateVersion(templateId, v, patch ?? {});

  if (!item) return Response.json({ ok: false, message: "VersiÃ³n no encontrada" }, { status: 404 });
  return Response.json({ ok: true, item });
}

