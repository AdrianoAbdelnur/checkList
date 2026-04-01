import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "@/lib/mongoose";
import User from "@/models/User";
import { requireUser } from "@/lib/auth/requireUser";
import { validatePassword } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, { allowMustChangePassword: true });
    if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");

    if (!validatePassword(currentPassword) || !validatePassword(newPassword)) {
      return NextResponse.json({ ok: false, message: "Contraseña inválida" }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { ok: false, message: "La nueva contraseña debe ser distinta a la actual" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const user = await User.findById((auth.user as any)._id).select("+password +salt");
    if (!user || !user.salt || !user.password) {
      return NextResponse.json({ ok: false, message: "Usuario no encontrado" }, { status: 404 });
    }

    const derivedCurrent = crypto.scryptSync(currentPassword, user.salt, 64).toString("hex");
    if (derivedCurrent !== user.password) {
      return NextResponse.json({ ok: false, message: "Contraseña actual incorrecta" }, { status: 401 });
    }

    const newSalt = crypto.randomBytes(16).toString("hex");
    const derivedNew = crypto.scryptSync(newPassword, newSalt, 64).toString("hex");

    user.salt = newSalt;
    user.password = derivedNew;
    (user as any).mustChangePassword = false;
    (user as any).passwordChangedAt = new Date();
    await user.save();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Error interno" }, { status: 500 });
  }
}
