import Session from "@/models/Session";
import User from "@/models/User";
import { connectToDatabase } from "@/lib/mongoose";
import { ensureGeneralTenant, getTenantAccessState } from "@/lib/tenants";

function readCookie(cookiesHeader: string, name: string) {
  const parts = cookiesHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq);
    if (k === name) return decodeURIComponent(p.slice(eq + 1));
  }
  return null;
}

export async function requireUser(
  req: Request,
  options?: { allowMustChangePassword?: boolean },
) {
  await connectToDatabase();
  await ensureGeneralTenant();

  const headerToken = (req.headers.get("x-session-token") ?? "").trim();

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieToken = cookieHeader ? readCookie(cookieHeader, "session") : null;

  const token = headerToken || cookieToken || "";
  if (!token) {
    return { ok: false as const, status: 401 as const, message: "No autorizado" };
  }

  const session = await Session.findOne({ token }).lean();
  if (!session) {
    return { ok: false as const, status: 401 as const, message: "Sesion invalida" };
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return { ok: false as const, status: 401 as const, message: "Sesion expirada" };
  }

  const user = await User.findById(session.userId).lean();
  if (!user) {
    return { ok: false as const, status: 401 as const, message: "Usuario no existe" };
  }

  if (Boolean((user as any).isDelete)) {
    return { ok: false as const, status: 401 as const, message: "Usuario eliminado" };
  }

  if (Boolean((user as any).mustChangePassword) && !options?.allowMustChangePassword) {
    return { ok: false as const, status: 403 as const, message: "Debe actualizar su contrasena" };
  }

  const tenantState = await getTenantAccessState(String((user as any).tenantId || "general"));
  if (!tenantState.exists || !tenantState.isActive) {
    return { ok: false as const, status: 403 as const, message: "Tenant inactivo" };
  }

  return { ok: true as const, user };
}
