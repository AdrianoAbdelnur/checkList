import { NextRequest, NextResponse } from "next/server";
import { validateLoginPayload } from "../../../../lib/validators";
import { connectToDatabase } from "../../../../lib/mongoose";
import User from "../../../../models/User";
import { createSession } from "../../../../lib/auth";
import { setSessionCookie } from "@/lib/server/session-cookie";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const errors = validateLoginPayload(body);

    if (Object.keys(errors).length) {
      return NextResponse.json(
        { ok: false, message: "Datos inválidos", details: errors },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email: body.email }).select("+password +salt");
    if (!user || !user.salt || !user.password) {
      return NextResponse.json(
        { ok: false, message: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const derived = crypto
      .scryptSync(body.password, user.salt, 64)
      .toString("hex");

    if (derived !== user.password) {
      return NextResponse.json(
        { ok: false, message: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const token = await createSession(user._id.toString());

    const res = NextResponse.json({
      ok: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    setSessionCookie(res, token);

    return res;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Error interno" },
      { status: 500 }
    );
  }
}
