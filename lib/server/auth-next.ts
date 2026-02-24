import type { NextRequest } from "next/server";
import { getSessionData, type SessionData } from "@/lib/auth";

type AuthFail = {
  ok: false;
  status: 401 | 403;
  error: string;
};

type AuthOk = {
  ok: true;
  session: SessionData;
};

export async function requireAuthSession(req: NextRequest): Promise<AuthOk | AuthFail> {
  const token = req.cookies.get("session")?.value;
  if (!token) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const session = await getSessionData(token);
  if (!session) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  return { ok: true, session };
}

export async function requireAdminSession(req: NextRequest): Promise<AuthOk | AuthFail> {
  const auth = await requireAuthSession(req);
  if (!auth.ok) return auth;

  if (auth.session.role !== "admin") {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  return auth;
}

export async function requireRolesSession(
  req: NextRequest,
  allowedRoles: string[]
): Promise<AuthOk | AuthFail> {
  const auth = await requireAuthSession(req);
  if (!auth.ok) return auth;

  if (!allowedRoles.includes(auth.session.role)) {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  return auth;
}
