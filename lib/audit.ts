import AuditEvent from "@/models/AuditEvent";

type AuditActor = {
  userId?: unknown;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type LogAuditEventInput = {
  req: Request;
  action: string;
  entityType: string;
  entityId: string;
  actor?: AuditActor | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

function getIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return "";
  const first = forwarded.split(",")[0]?.trim();
  return first ?? "";
}

function getRequestId(req: Request): string {
  const provided = req.headers.get("x-request-id")?.trim();
  if (provided) return provided.slice(0, 200);
  return crypto.randomUUID();
}

function getPathname(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "";
  }
}

export function actorFromUser(user: any): AuditActor {
  return {
    userId: user?._id ?? null,
    email: String(user?.email ?? ""),
    firstName: String(user?.firstName ?? ""),
    lastName: String(user?.lastName ?? ""),
    role: String(user?.role ?? ""),
  };
}

export function cloneForAudit<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function logAuditEvent(input: LogAuditEventInput) {
  await AuditEvent.create({
    occurredAt: new Date(),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actor: {
      userId: input.actor?.userId ?? null,
      email: String(input.actor?.email ?? ""),
      firstName: String(input.actor?.firstName ?? ""),
      lastName: String(input.actor?.lastName ?? ""),
      role: String(input.actor?.role ?? ""),
    },
    requestId: getRequestId(input.req),
    requestMethod: input.req.method,
    requestPath: getPathname(input.req),
    ip: getIp(input.req),
    userAgent: input.req.headers.get("user-agent") ?? "",
    before: input.before ?? null,
    after: input.after ?? null,
    meta: input.meta ?? null,
  });
}
