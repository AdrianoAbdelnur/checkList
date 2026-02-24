import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type ListChecklistsInput = {
  inspectorId?: unknown;
  includeAll?: boolean;
  templateId?: string | null;
  status?: string | null;
  plate?: string | null;
};

export async function listChecklistsForInspector({
  inspectorId,
  includeAll = false,
  templateId,
  status,
  plate,
}: ListChecklistsInput) {
  await connectToDatabase();

  const q: any = {};
  if (!includeAll && inspectorId) q.inspectorId = inspectorId;
  if (templateId) q.templateId = templateId;
  if (status) q.status = status;
  if (plate) q["data.subject.plate"] = plate;

  return Checklist.find(q)
    .sort({ createdAt: -1 })
    .populate("inspectorId", "firstName lastName email role")
    .lean();
}

export async function getChecklistWithTemplateById(id: string) {
  await connectToDatabase();

  const checklist = await Checklist.findById(id)
    .populate("inspectorId", "firstName lastName email role")
    .lean();

  if (!checklist) return null;

  const template = await ChecklistTemplate.findOne({
    templateId: (checklist as any).templateId,
    version: (checklist as any).templateVersion,
  }).lean();

  if (!template) {
    return { checklist, template: null as any };
  }

  return { checklist, template };
}
