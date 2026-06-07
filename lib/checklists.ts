import { connectToDatabase } from "@/lib/db";
import { canAccessTenant, isSuperAdmin } from "@/lib/roles";
import Checklist from "@/models/Checklist";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type AccessUser = {
  _id?: unknown;
  userId?: string;
  tenantId?: string | null;
  role?: string | null;
  roles?: string[] | null;
};

type ListChecklistsInput = {
  user: AccessUser;
  inspectorId?: unknown;
  includeAll?: boolean;
  templateId?: string | null;
  status?: string | null;
  plate?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  tripDateFrom?: string | null;
  tripDateTo?: string | null;
};

function tenantScopeQuery(tenantId: string) {
  return {
    $or: [
      { tenantId },
      { tenantId: { $exists: false } },
      { tenantId: null },
      { tenantId: "" },
    ],
  };
}

export function canAccessChecklist(user: AccessUser, checklist: any, includeAll = false) {
  if (!canAccessTenant(user as any, checklist?.tenantId)) return false;
  if (isSuperAdmin(user as any)) return true;
  if (includeAll) return true;

  const currentUserId = String(user?._id ?? user?.userId ?? "").trim();
  const inspectorId = String(checklist?.inspectorId?._id ?? checklist?.inspectorId ?? "").trim();
  return !!currentUserId && !!inspectorId && currentUserId === inspectorId;
}

export async function listChecklistsForInspector({
  user,
  inspectorId,
  includeAll = false,
  templateId,
  status,
  plate,
  dateFrom,
  dateTo,
  tripDateFrom,
  tripDateTo,
}: ListChecklistsInput) {
  await connectToDatabase();

  const q: any = {};
  if (!isSuperAdmin(user as any)) {
    Object.assign(q, tenantScopeQuery(String(user?.tenantId || "general").trim() || "general"));
  }
  if (!includeAll && inspectorId) q.inspectorId = inspectorId;
  if (templateId) q.templateId = templateId;
  if (status) q.status = status;
  if (plate) q["data.subject.plate"] = plate;
  if (dateFrom || dateTo) {
    q.submittedAt = {};
    if (dateFrom) q.submittedAt.$gte = dateFrom;
    if (dateTo) q.submittedAt.$lte = dateTo;
  }
  if (tripDateFrom || tripDateTo) {
    const tripDateClauses: any[] = [];
    const withRange = (field: string) => {
      const range: any = {};
      if (tripDateFrom) range.$gte = tripDateFrom;
      if (tripDateTo) range.$lte = tripDateTo;
      tripDateClauses.push({ [field]: range });
    };
    withRange("data.values.trip_date.value");
    withRange("data.assignment.tripDateKey");
    withRange("data.meta.tripDateKey");
    q.$and = [...(q.$and ?? []), { $or: tripDateClauses }];
  }

  return Checklist.find(q)
    .sort({ createdAt: -1 })
    .populate("inspectorId", "firstName lastName email role tenantId")
    .lean();
}

export async function getChecklistWithTemplateById(id: string, user?: AccessUser, includeAll = false) {
  await connectToDatabase();

  const checklist = await Checklist.findById(id)
    .populate("inspectorId", "firstName lastName email role tenantId")
    .lean();

  if (!checklist) return null;
  if (user && !canAccessChecklist(user, checklist, includeAll)) return false;

  const template = await ChecklistTemplate.findOne({
    templateId: (checklist as any).templateId,
    version: (checklist as any).templateVersion,
  }).lean();

  if (!template) {
    return { checklist, template: null as any };
  }

  return { checklist, template };
}
