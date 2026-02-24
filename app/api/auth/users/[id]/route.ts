import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "../../../../../lib/mongoose";
import User from "../../../../../models/User";
import { requireAdminSession } from "@/lib/server/auth-next";
import { isAppRole } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await connectToDatabase();
  try {
    const user = await User.findOne({ _id: id, isDelete: { $ne: true } })
      .select("-password -salt")
      .lean();

    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 403 ? "Solo administradores pueden editar usuarios" : auth.error },
      { status: auth.status }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, telephone, userId, role, email, password } = body;
  const { id: routeId } = await ctx.params;
  const targetId = userId || routeId;

  if (!targetId) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  if (role && !isAppRole(String(role))) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const update: any = {};
  if (firstName !== undefined) update.firstName = firstName;
  if (lastName !== undefined) update.lastName = lastName;
  if (telephone !== undefined) update.telephone = telephone;
  if (role !== undefined) update.role = role;
  if (email !== undefined) update.email = String(email).trim().toLowerCase();

  if (email !== undefined && !update.email) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const hasPasswordUpdate = password !== undefined && String(password).trim().length > 0;
  if (Object.keys(update).length === 0 && !hasPasswordUpdate) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  await connectToDatabase();

  try {
    if (update.email) {
      const existing = await User.findOne({
        email: update.email,
        _id: { $ne: targetId },
        isDelete: { $ne: true },
      }).lean();

      if (existing) {
        return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
      }
    }

    if (hasPasswordUpdate) {
      const salt = crypto.randomBytes(16).toString("hex");
      const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
      update.salt = salt;
      update.password = derived;
    }

    const updatedUser = await User.findByIdAndUpdate(targetId, update, { new: true }).select(
      "-password -salt"
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch {
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: targetId } = await ctx.params;
  if (!targetId) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await connectToDatabase();
  try {
    const deleted = await User.findByIdAndUpdate(targetId, { isDelete: true }, { new: true }).select(
      "-password -salt"
    );
    if (!deleted) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, user: deleted });
  } catch {
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}
