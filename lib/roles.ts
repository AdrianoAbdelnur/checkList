export const ROLE_VALUES = ["inspector", "reviewer", "admin"] as const;

export type AppRole = (typeof ROLE_VALUES)[number];

export function isAppRole(value: string): value is AppRole {
  return (ROLE_VALUES as readonly string[]).includes(value);
}

export function roleLabelEs(role?: string | null) {
  switch (role) {
    case "inspector":
      return "Inspector";
    case "reviewer":
      return "Revisor";
    case "admin":
      return "Administrador";
    default:
      return role || "—";
  }
}

export const ROLE_OPTIONS_ES: Array<{ value: AppRole; label: string }> = [
  { value: "inspector", label: "Inspector" },
  { value: "reviewer", label: "Revisor" },
  { value: "admin", label: "Administrador" },
];
