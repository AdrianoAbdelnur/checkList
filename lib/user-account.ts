import Counter from "@/models/Counter";

export const USER_ACCOUNT_STATUSES = ["activo", "provisorio"] as const;

export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export function normalizeUserAccountStatus(value: unknown): UserAccountStatus | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "activo" || normalized === "provisorio") return normalized;
  return null;
}

export async function getNextUserNumber(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { key: "userNumber" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  return String(counter?.seq || "");
}
