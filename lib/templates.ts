import { connectToDatabase } from "@/lib/db";
import { isSuperAdmin } from "@/lib/roles";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type TenantUser = {
  tenantId?: string | null;
  role?: string | null;
  roles?: string[] | null;
};

function normalizeTenantId(value: unknown) {
  return String(value ?? "").trim();
}

export function canUserAccessTemplate(user: TenantUser, template: any) {
  if (isSuperAdmin(user)) return true;

  const accessMode = String(template?.accessMode ?? "all").trim();
  if (accessMode !== "selected") return true;

  const tenantId = normalizeTenantId(user?.tenantId || "general");
  const allowedTenantIds = Array.isArray(template?.allowedTenantIds)
    ? template.allowedTenantIds.map((item: unknown) => normalizeTenantId(item)).filter(Boolean)
    : [];

  if (!tenantId) return false;
  if (allowedTenantIds.length === 0) return true;
  return allowedTenantIds.includes(tenantId);
}

export async function listLatestActiveTemplates() {
  await connectToDatabase();

  const docs = await ChecklistTemplate.find({ isActive: true })
    .sort({ templateId: 1, version: -1 })
    .lean();

  const map = new Map<string, any>();
  for (const d of docs) {
    if (!map.has(d.templateId)) map.set(d.templateId, d);
  }

  return Array.from(map.values()).sort((a, b) => a.templateId.localeCompare(b.templateId));
}

export async function listLatestActiveTemplatesForUser(user: TenantUser) {
  const items = await listLatestActiveTemplates();
  return items.filter((item) => canUserAccessTemplate(user, item));
}

export async function getActiveTemplateByTemplateId(templateId: string) {
  await connectToDatabase();
  return ChecklistTemplate.findOne({ templateId, isActive: true })
    .sort({ version: -1 })
    .lean();
}

export async function getActiveTemplateByTemplateIdForUser(user: TenantUser, templateId: string) {
  const item = await getActiveTemplateByTemplateId(templateId);
  if (!item) return null;
  if (!canUserAccessTemplate(user, item)) return false;
  return item;
}

export async function listTemplateVersions(templateId: string) {
  await connectToDatabase();
  return ChecklistTemplate.find({ templateId }).sort({ version: -1 }).lean();
}

export async function getTemplateVersion(templateId: string, version: number) {
  await connectToDatabase();
  return ChecklistTemplate.findOne({ templateId, version }).lean();
}

export async function createTemplateVersion(params: {
  id?: string;
  templateId: string;
  title: string;
  shortTitle?: string;
  sections: unknown;
  metrics?: unknown;
  rules?: unknown;
  isActive?: boolean;
  accessMode?: "all" | "selected";
  allowedTenantIds?: string[];
}) {
  await connectToDatabase();

  const last = await ChecklistTemplate.findOne({ templateId: params.templateId })
    .sort({ version: -1 })
    .lean();
  const nextVersion = (last?.version ?? 0) + 1;

  return ChecklistTemplate.create({
    id: params.id || params.templateId,
    templateId: params.templateId,
    version: nextVersion,
    title: params.title,
    shortTitle: params.shortTitle || undefined,
    sections: params.sections,
    metrics: Array.isArray(params.metrics) ? params.metrics : [],
    rules: Array.isArray(params.rules) ? params.rules : [],
    isActive: params.isActive ?? true,
    accessMode: params.accessMode ?? "all",
    allowedTenantIds: Array.isArray(params.allowedTenantIds) ? params.allowedTenantIds : [],
  });
}

export async function patchTemplateVersion(
  templateId: string,
  version: number,
  patch: Record<string, unknown>
) {
  await connectToDatabase();
  return ChecklistTemplate.findOneAndUpdate(
    { templateId, version },
    { $set: patch },
    { new: true }
  ).lean();
}

export async function deleteTemplateVersion(templateId: string, version: number) {
  await connectToDatabase();
  return ChecklistTemplate.findOneAndDelete({ templateId, version }).lean();
}
