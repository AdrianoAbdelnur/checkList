import { connectToDatabase } from "@/lib/db";
import ChecklistTemplate from "@/models/ChecklistTemplate";

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

export async function getActiveTemplateByTemplateId(templateId: string) {
  await connectToDatabase();
  return ChecklistTemplate.findOne({ templateId, isActive: true })
    .sort({ version: -1 })
    .lean();
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
