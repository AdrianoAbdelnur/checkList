import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/server/session-cookie";
import { connectToDatabase } from "@/lib/mongoose";
import { ensureGeneralTenant, getActiveTenantByCode } from "@/lib/tenants";
import { validateEmail } from "@/lib/validators";
import { getNextUserNumber } from "@/lib/user-account";
import User from "@/models/User";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const firstName = normalizeText(body?.firstName);
  const lastName = normalizeText(body?.lastName);
  const email = normalizeText(body?.email).toLowerCase();
  const telephone = normalizeText(body?.telephone);
  const dni = normalizeText(body?.dni);
  const password = String(body?.password ?? "");

  if (!firstName || !lastName || !telephone || !dni) {
    return NextResponse.json(
      { ok: false, message: "Nombre, apellido, telefono y dni son requeridos" },
      { status: 400 },
    );
  }

  if (!validateEmail(email)) {
    return NextResponse.json({ ok: false, message: "Email invalido" }, { status: 400 });
  }

  if (password.trim().length < 4) {
    return NextResponse.json(
      { ok: false, message: "La contraseña debe tener al menos 4 caracteres" },
      { status: 400 },
    );
  }

  await connectToDatabase();

  try {
    await ensureGeneralTenant();
    const generalTenant = await getActiveTenantByCode("general");
    if (!generalTenant) {
      return NextResponse.json(
        { ok: false, message: "El tenant general no esta disponible" },
        { status: 500 },
      );
    }

    const existing = await User.findOne({
      email,
      isDelete: { $ne: true },
    }).lean();

    if (existing) {
      return NextResponse.json({ ok: false, message: "Email ya registrado" }, { status: 409 });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    const nextUserNumber = await getNextUserNumber();

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: derived,
      salt,
      telephone,
      dni,
      role: "inspector",
      roles: ["inspector"],
      status: "provisorio",
      tenantId: "general",
      userNumber: nextUserNumber,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    });

    const token = await createSession(String(user._id));

    const res = NextResponse.json({
      ok: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        telephone: user.telephone,
        dni: user.dni,
        role: user.role,
        roles: user.roles,
        status: "provisorio",
        tenantId: "general",
        mustChangePassword: false,
      },
    });

    setSessionCookie(res, token);
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ? String(e.message) : "Error al registrar usuario" },
      { status: 500 },
    );
  }
}
