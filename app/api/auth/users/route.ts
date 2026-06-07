import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/mongoose";
import User from "../../../../models/User";
import Counter from "../../../../models/Counter";
import crypto from "crypto";
import { requireAdminSession } from "@/lib/server/auth-next";
import { canAccessTenant, getPrimaryRole, isAppRole, isSuperAdmin, normalizeRoles } from "@/lib/roles";
import { ensureGeneralTenant, getActiveTenantByCode } from "@/lib/tenants";

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

async function getNextUserNumber(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { key: "userNumber" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return String(counter?.seq || "");
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await connectToDatabase();
  try {
    await ensureGeneralTenant();
    const query: any = { isDelete: { $ne: true } };
    if (!isSuperAdmin(auth.session)) {
      Object.assign(query, tenantScopeQuery(String(auth.session.tenantId || "general").trim() || "general"));
    }
    const users = await User.find(query).select("-password -salt").lean();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Error al listar usuarios" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, email, password, role, roles, telephone, userNumber, inspectorNumber, tenantId } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email y password son requeridos" }, { status: 400 });
  }

  if (userNumber !== undefined || inspectorNumber !== undefined) {
    return NextResponse.json({ error: "userNumber se asigna automaticamente" }, { status: 400 });
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
  if (isSuperAdmin(auth.session) && tenantId === undefined) {
    return NextResponse.json({ error: "Debe seleccionar un tenant" }, { status: 400 });
  }

  await connectToDatabase();
  try {
    await ensureGeneralTenant();
    const existing = await User.findOne({ email }).lean();
    if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });

    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    const nextUserNumber = await getNextUserNumber();

    const normalizedRoles = normalizeRoles({
      role: role ?? undefined,
      roles: Array.isArray(roles) ? roles : undefined,
    });
    const primaryRole = getPrimaryRole({ role: role ?? undefined, roles: normalizedRoles });
    const persistedRoles = normalizedRoles.length > 0 ? normalizedRoles : [primaryRole];
    const nextTenantId = String(tenantId ?? auth.session.tenantId ?? "general").trim() || "general";

    if (!isSuperAdmin(auth.session) && !canAccessTenant(auth.session, nextTenantId)) {
      return NextResponse.json({ error: "No autorizado para ese tenant" }, { status: 403 });
    }
    const activeTenant = await getActiveTenantByCode(nextTenantId);
    if (!activeTenant) {
      return NextResponse.json({ error: "Debe seleccionar un tenant activo" }, { status: 400 });
    }

    const user = new User({
      firstName: firstName || "",
      lastName: lastName || "",
      email,
      password: derived,
      salt,
      role: primaryRole,
      roles: persistedRoles,
      tenantId: nextTenantId,
      telephone: telephone || "",
      userNumber: nextUserNumber,
      mustChangePassword: true,
      passwordChangedAt: null,
    });

    await user.save();
    const u = await User.findById(user._id).select("-password -salt").lean();

    return NextResponse.json({ user: u }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? `Error al crear usuario: ${String(e.message)}` : "Error al crear usuario" },
      { status: 500 },
    );
  }
}
