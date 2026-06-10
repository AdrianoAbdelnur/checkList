export function normalizeCompany(value: unknown) {
  return String(value ?? "").trim();
}

export function isCompanyRequiredForTenant(tenantId: unknown) {
  return String(tenantId ?? "general").trim().toLowerCase() !== "cys";
}

export function getCompanyValidationError(company: unknown, tenantId: unknown) {
  const normalizedCompany = normalizeCompany(company);
  if (!isCompanyRequiredForTenant(tenantId)) return null;
  return normalizedCompany ? null : "Empresa requerida";
}
