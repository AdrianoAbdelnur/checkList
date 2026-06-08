import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "../../../../../lib/mongoose";
import User from "../../../../../models/User";
import { requireAdminSession } from "@/lib/server/auth-next";
import { canAccessTenant, getPrimaryRole, isAppRole, isSuperAdmin, normalizeRoles } from "@/lib/roles";
import { ensureGeneralTenant, getActiveTenantByCode } from "@/lib/tenants";
import { normalizeUserAccountStatus } from "@/lib/user-account";

function containsSuperAdminRole(inputRole: unknown, inputRoles: unknown) {
  if (String(inputRole ?? "").trim() === "superAdmin") return true;
  return Array.isArray(inputRoles) && inputRoles.some((item) => String(item ?? "").trim() === "superAdmin");
}

type Ctx = { params: Promise<{ id: string }> };

function tenantScopeQuery(tenantId: string) {
  return {
    $or: [
      { tenantId },
      { tenantId: { $exists: false } },
      { tenantId: null },
      { tenantId: "" },
    ],
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await connectToDatabase();
  try {
    await ensureGeneralTenant();
    const query: any = { _id: id, isDelete: { $ne: true } };
    if (!isSuperAdmin(auth.session)) {
      Object.assign(query, tenantScopeQuery(String(auth.session.tenantId || "general").trim() || "general"));
    }
    const user = await User.findOne(query)
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
      { status: auth.status },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, telephone, dni, status, userId, role, roles, email, password, userNumber, inspectorNumber, tenantId } = body;
  const { id: routeId } = await ctx.params;
  const targetId = userId || routeId;

  if (!targetId) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  if (userNumber !== undefined || inspectorNumber !== undefined) {
    return NextResponse.json({ error: "userNumber no se puede editar" }, { status: 400 });
  }

  if (role !== undefined && !isAppRole(String(role))) {
    return NextResponse.json({ error: "Rol invalido" }, { status: 400 });
  }

  if (roles !== undefined && !Array.isArray(roles)) {
    return NextResponse.json({ error: "roles debe ser array" }, { status: 400 });
  }

  if (Array.isArray(roles) && roles.some((r) => !isAppRole(String(r)))) {
    return NextResponse.json({ error: "roles contiene valores invalidos" }, { status: 400 });
  }
  if (containsSuperAdminRole(role, roles)) {
    return NextResponse.json({ error: "superAdmin solo se puede asignar desde la base de datos" }, { status: 400 });
  }

  const update: any = {};
  if (firstName !== undefined) update.firstName = firstName;
  if (lastName !== undefined) update.lastName = lastName;
  if (telephone !== undefined) update.telephone = telephone;
  if (dni !== undefined) update.dni = String(dni).trim();
  if (email !== undefined) update.email = String(email).trim().toLowerCase();

  if (email !== undefined && !update.email) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }
  if (status !== undefined) {
    const normalizedStatus = normalizeUserAccountStatus(status);
    if (!normalizedStatus) {
      return NextResponse.json({ error: "Status invalido" }, { status: 400 });
    }
    update.status = normalizedStatus;
  }

  const hasPasswordUpdate = password !== undefined && String(password).trim().length > 0;

  await connectToDatabase();

  try {
    await ensureGeneralTenant();
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

    const current = await User.findById(targetId).lean();
    if (!current) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    if (!isSuperAdmin(auth.session) && !canAccessTenant(auth.session, (current as any).tenantId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const nextRoles =
      roles !== undefined || role !== undefined
        ? normalizeRoles({
            role: role ?? (current as any).role,
            roles: Array.isArray(roles) ? roles : (current as any).roles,
          })
        : normalizeRoles({ role: (current as any).role, roles: (current as any).roles });
    const primaryRole = getPrimaryRole({
      role: role ?? (current as any).role,
      roles: nextRoles,
    });
    const persistedRoles = nextRoles.length > 0 ? nextRoles : [primaryRole];

    if (roles !== undefined || role !== undefined) {
      update.roles = persistedRoles;
      update.role = primaryRole;
    }

    if (tenantId !== undefined) {
      const nextTenantId = String(tenantId).trim() || "general";
      if (!isSuperAdmin(auth.session) && !canAccessTenant(auth.session, nextTenantId)) {
        return NextResponse.json({ error: "No autorizado para ese tenant" }, { status: 403 });
      }
      const activeTenant = await getActiveTenantByCode(nextTenantId);
      if (!activeTenant) {
        return NextResponse.json({ error: "Debe seleccionar un tenant activo" }, { status: 400 });
      }
      update.tenantId = nextTenantId;
    }

    if (hasPasswordUpdate) {
      const salt = crypto.randomBytes(16).toString("hex");
      const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
      update.salt = salt;
      update.password = derived;
      update.mustChangePassword = true;
      update.passwordChangedAt = null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
    }

    const updatedUser = await User.findByIdAndUpdate(targetId, update, { new: true }).select(
      "-password -salt",
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? `Error al actualizar usuario: ${String(e.message)}` : "Error al actualizar usuario" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: targetId } = await ctx.params;
  if (!targetId) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await connectToDatabase();
  try {
    await ensureGeneralTenant();
    const current = await User.findById(targetId).lean();
    if (!current) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!isSuperAdmin(auth.session) && !canAccessTenant(auth.session, (current as any).tenantId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const deleted = await User.findByIdAndUpdate(targetId, { isDelete: true }, { new: true }).select(
      "-password -salt",
    );
    if (!deleted) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, user: deleted });
  } catch {
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}
