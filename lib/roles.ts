export const ROLE_VALUES = [
  "inspector",
  "reviewer",
  "supervisor",
  "admin",
  "client",
  "auditor",
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
    case "admin":
      return "Administrator";
    case "client":
      return "Client";
    case "auditor":
      return "Auditor";
    default:
      return role || "-";
  }
}

export const ROLE_OPTIONS_ES: Array<{ value: AppRole; label: string }> = [
  { value: "inspector", label: "Inspector" },
  { value: "reviewer", label: "Reviewer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "admin", label: "Administrator" },
  { value: "client", label: "Client" },
  { value: "auditor", label: "Auditor" },
];

export type RoleCarrier =
  | string
  | null
  | undefined
  | {
      role?: string | null;
      roles?: string[] | null;
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
  | "report.audit"
  | "report.client"
  | "vehicle.client_upload_docs";

export const ROLE_PERMISSIONS: Record<AppRole, ReadonlyArray<AppPermission>> = {
  inspector: ["checklist.create", "checklist.view_assigned"],
  reviewer: [
    "checklist.view_assigned",
    "checklist.review",
    "checklist.approve_reject",
    "dashboard.metrics",
    "template.manage",
  ],
  supervisor: [
    "checklist.view_all",
    "checklist.reassign",
    "dashboard.metrics",
    "report.audit",
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
    "report.audit",
    "report.client",
    "vehicle.client_upload_docs",
  ],
  client: ["report.client", "vehicle.client_upload_docs"],
  auditor: ["checklist.view_all", "report.audit", "dashboard.metrics"],
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
  const priority: AppRole[] = [
    "admin",
    "supervisor",
    "reviewer",
    "inspector",
    "auditor",
    "client",
  ];
  return priority.find((r) => roles.includes(r)) ?? "inspector";
}

export function hasRole(input: RoleCarrier, role: AppRole) {
  return normalizeRoles(input).includes(role);
}

export function hasAnyRole(input: RoleCarrier, roles: string[]) {
  const current = normalizeRoles(input);
  return roles.some((r) => isAppRole(r) && current.includes(r));
}

export function hasPermission(input: RoleCarrier, permission: AppPermission) {
  const roles = normalizeRoles(input);
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}
