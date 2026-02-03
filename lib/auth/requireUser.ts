import Session from "@/models/Session";
import User from "@/models/User";

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

export async function requireUser(req: Request) {
  const headerToken = (req.headers.get("x-session-token") ?? "").trim();

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieToken = cookieHeader ? readCookie(cookieHeader, "session") : null;

  const token = headerToken || cookieToken || "";
  if (!token) {
    return { ok: false as const, status: 401 as const, message: "No autorizado" };
  }

  const session = await Session.findOne({ token }).lean();
  if (!session) {
    return { ok: false as const, status: 401 as const, message: "Sesión inválida" };
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return { ok: false as const, status: 401 as const, message: "Sesión expirada" };
  }

  const user = await User.findById(session.userId).lean();
  if (!user) {
    return { ok: false as const, status: 401 as const, message: "Usuario no existe" };
  }

  return { ok: true as const, user };
}
