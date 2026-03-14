import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/mongoose";
import User from "../../../../models/User";
import crypto from "crypto";
import { requireAdminSession } from "@/lib/server/auth-next";
import { getPrimaryRole, isAppRole, normalizeRoles } from "@/lib/roles";

function normalizeInspectorNumber(input: unknown): string | undefined {
  const value = String(input ?? "").trim();
  return value ? value : undefined;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await connectToDatabase();
  try {
    const users = await User.find({ isDelete: { $ne: true } }).select("-password -salt").lean();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Error al listar usuarios" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, email, password, role, roles, telephone, inspectorNumber } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email y password son requeridos" }, { status: 400 });
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

  const normalizedInspectorNumber = normalizeInspectorNumber(inspectorNumber);
  if (normalizedInspectorNumber && !/^\d+$/.test(normalizedInspectorNumber)) {
    return NextResponse.json({ error: "inspectorNumber debe contener solo números" }, { status: 400 });
  }

  await connectToDatabase();
  try {
    const existing = await User.findOne({ email }).lean();
    if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });

    if (normalizedInspectorNumber) {
      const existingInspectorNumber = await User.findOne({
        inspectorNumber: normalizedInspectorNumber,
        isDelete: { $ne: true },
      }).lean();
      if (existingInspectorNumber) {
        return NextResponse.json({ error: "Número de inspector ya registrado" }, { status: 409 });
      }
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");

    const normalizedRoles = normalizeRoles({
      role: role ?? undefined,
      roles: Array.isArray(roles) ? roles : undefined,
    });
    const primaryRole = getPrimaryRole({ role: role ?? undefined, roles: normalizedRoles });
    const persistedRoles = normalizedRoles.length > 0 ? normalizedRoles : [primaryRole];

    const user = new User({
      firstName: firstName || "",
      lastName: lastName || "",
      email,
      password: derived,
      salt,
      role: primaryRole,
      roles: persistedRoles,
      telephone: telephone || "",
      inspectorNumber: normalizedInspectorNumber,
    });

    await user.save();
    const u = await User.findById(user._id).select("-password -salt").lean();

    return NextResponse.json({ user: u }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
