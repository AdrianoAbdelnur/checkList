export const ROLE_VALUES = [
  "inspector",
  "reviewer",
  "supervisor",
  "manager",
  "admin",
  "superAdmin",
] as const;

export type AppRole = (typeof ROLE_VALUES)[number];

export function isAppRole(value: string): value is AppRole {
  return (ROLE_VALUES as readonly string[]).includes(value);
}

export function roleLabelEs(role?: string | null) {
  switch (role) {
    case "inspector":
      return "Inspector";
    case "reviewer":
      return "Reviewer";
    case "supervisor":
      return "Supervisor";
    case "manager":
      return "Manager";
    case "admin":
      return "Administrator";
    case "superAdmin":
      return "Super Admin";
    default:
      return role || "-";
  }
}

export const ROLE_OPTIONS_ES: Array<{ value: AppRole; label: string }> = [
  { value: "inspector", label: "Inspector" },
  { value: "reviewer", label: "Reviewer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Administrator" },
  { value: "superAdmin", label: "Super Admin" },
];

export type RoleCarrier =
  | string
  | null
  | undefined
  | {
      role?: string | null;
      roles?: string[] | null;
      tenantId?: string | null;
    };

export type AppPermission =
  | "checklist.create"
  | "checklist.view_assigned"
  | "checklist.view_all"
  | "checklist.review"
  | "checklist.approve_reject"
  | "checklist.reassign"
  | "template.manage"
  | "user.manage"
  | "dashboard.metrics"
  | "special.authorize";

export const ROLE_PERMISSIONS: Record<AppRole, ReadonlyArray<AppPermission>> = {
  inspector: ["checklist.create", "checklist.view_assigned"],
  reviewer: ["checklist.view_all"],
  supervisor: ["checklist.view_all", "checklist.review", "checklist.approve_reject", "dashboard.metrics"],
  manager: [
    "checklist.view_all",
    "checklist.review",
    "checklist.approve_reject",
    "dashboard.metrics",
    "special.authorize",
  ],
  admin: [
    "checklist.create",
    "checklist.view_all",
    "checklist.review",
    "checklist.approve_reject",
    "checklist.reassign",
    "template.manage",
    "user.manage",
    "dashboard.metrics",
    "special.authorize",
  ],
  superAdmin: [
    "checklist.create",
    "checklist.view_all",
    "checklist.review",
    "checklist.approve_reject",
    "checklist.reassign",
    "template.manage",
    "user.manage",
    "dashboard.metrics",
    "special.authorize",
  ],
};

export function normalizeRoles(input: RoleCarrier): AppRole[] {
  const raw: string[] = [];

  if (typeof input === "string") raw.push(input);
  if (input && typeof input === "object") {
    if (Array.isArray(input.roles)) raw.push(...input.roles);
    if (typeof input.role === "string") raw.push(input.role);
  }

  const seen = new Set<AppRole>();
  for (const r of raw) {
    if (isAppRole(r)) seen.add(r);
  }

  return Array.from(seen);
}

export function getPrimaryRole(input: RoleCarrier): AppRole {
  const roles = normalizeRoles(input);
  const priority: AppRole[] = ["superAdmin", "admin", "manager", "supervisor", "reviewer", "inspector"];
  return priority.find((r) => roles.includes(r)) ?? "inspector";
}

export function hasRole(input: RoleCarrier, role: AppRole) {
  return normalizeRoles(input).includes(role);
}

export function hasAnyRole(input: RoleCarrier, roles: string[]) {
  const current = normalizeRoles(input);
  if (current.includes("superAdmin")) return true;
  return roles.some((r) => isAppRole(r) && current.includes(r));
}

export function hasPermission(input: RoleCarrier, permission: AppPermission) {
  const roles = normalizeRoles(input);
  if (roles.includes("superAdmin")) return true;
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function isSuperAdmin(input: RoleCarrier) {
  return normalizeRoles(input).includes("superAdmin");
}

export function canAccessTenant(input: RoleCarrier, tenantId: string | null | undefined) {
  if (isSuperAdmin(input)) return true;

  const currentTenantId = String(
    input && typeof input === "object" && "tenantId" in input ? input.tenantId ?? "general" : "general",
  ).trim() || "general";
  const requestedTenantId = String(tenantId ?? "general").trim() || "general";
  return !!currentTenantId && !!requestedTenantId && currentTenantId === requestedTenantId;
}
