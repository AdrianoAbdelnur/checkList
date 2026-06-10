export const USER_ACCOUNT_STATUSES = ["activo", "provisorio"] as const;

export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export function normalizeUserAccountStatus(value: unknown): UserAccountStatus | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "activo" || normalized === "provisorio") return normalized;
  return null;
}
