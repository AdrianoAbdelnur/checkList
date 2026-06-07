import Tenant from "@/models/Tenant";

export function normalizeTenantCode(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function generateTenantCode(name: unknown) {
  return normalizeTenantCode(name) || "tenant";
}

export async function ensureGeneralTenant() {
  const existing = await Tenant.findOne({ code: "general" }).lean();
  if (existing) return existing;

  const created = await Tenant.create({
    name: "General",
    code: "general",
    isActive: true,
    isDelete: false,
  });

  return created.toObject();
}

export async function getTenantByCode(code: string) {
  return Tenant.findOne({ code: normalizeTenantCode(code), isDelete: { $ne: true } }).lean();
}

export async function getActiveTenantByCode(code: string) {
  return Tenant.findOne({
    code: normalizeTenantCode(code),
    isDelete: { $ne: true },
    isActive: true,
  }).lean();
}

export async function getTenantAccessState(code: string) {
  const normalizedCode = normalizeTenantCode(code) || "general";
  const tenant = await Tenant.findOne({
    code: normalizedCode,
    isDelete: { $ne: true },
  }).lean();

  return {
    code: normalizedCode,
    exists: Boolean(tenant),
    isActive: Boolean((tenant as any)?.isActive),
    tenant,
  };
}
