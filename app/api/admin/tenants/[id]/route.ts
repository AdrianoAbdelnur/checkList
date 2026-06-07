import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import { requireAdminSession } from "@/lib/server/auth-next";
import { isSuperAdmin } from "@/lib/roles";
import { ensureGeneralTenant } from "@/lib/tenants";
import Tenant from "@/models/Tenant";
import User from "@/models/User";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "Solo super admin puede editar tenants" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = await ctx.params;
  const name = body?.name !== undefined ? String(body.name).trim() : undefined;
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : undefined;

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (body?.code !== undefined) {
    return NextResponse.json({ error: "El codigo no se puede editar" }, { status: 400 });
  }

  await connectToDatabase();
  try {
    await ensureGeneralTenant();

    const current = await Tenant.findOne({ _id: id, isDelete: { $ne: true } }).lean();
    if (!current) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    if (String((current as any).code || "") === "general" && isActive === false) {
      return NextResponse.json({ error: "El tenant general no se puede desactivar" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
      update.name = name;
    }
    if (isActive !== undefined) update.isActive = isActive;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
    }

    const tenant = await Tenant.findByIdAndUpdate(id, update, { new: true }).lean();
    return NextResponse.json({ tenant });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? `Error al actualizar tenant: ${String(e.message)}` : "Error al actualizar tenant" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isSuperAdmin(auth.session)) {
    return NextResponse.json({ error: "Solo super admin puede desactivar tenants" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await connectToDatabase();
  try {
    await ensureGeneralTenant();

    const current = await Tenant.findOne({ _id: id, isDelete: { $ne: true } }).lean();
    if (!current) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    if (String((current as any).code || "") === "general") {
      return NextResponse.json({ error: "El tenant general no se puede desactivar" }, { status: 400 });
    }

    const usersCount = await User.countDocuments({
      tenantId: String((current as any).code || ""),
      isDelete: { $ne: true },
    });

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    ).lean();

    return NextResponse.json({ tenant, usersCount });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? `Error al desactivar tenant: ${String(e.message)}` : "Error al desactivar tenant" },
      { status: 500 },
    );
  }
}
