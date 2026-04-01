import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import { requireAdminSession } from "@/lib/server/auth-next";
import { hasRole } from "@/lib/roles";
import User from "@/models/User";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type TemplateRow = {
  templateId: string;
  title: string;
  shortTitle?: string;
  version: number;
  isActive: boolean;
};

function normalizeTemplateIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const item of input) {
    const value = String(item ?? "").trim();
    if (!value) continue;
    seen.add(value);
  }
  return Array.from(seen);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await connectToDatabase();

  const templateDocs = await ChecklistTemplate.find({})
    .sort({ templateId: 1, version: -1 })
    .select("templateId title shortTitle version isActive")
    .lean();

  const map = new Map<string, TemplateRow>();
  for (const doc of templateDocs as any[]) {
    const key = String(doc.templateId || "").trim();
    if (!key || map.has(key)) continue;
    map.set(key, {
      templateId: key,
      title: String(doc.title || key),
      shortTitle: String((doc as any).shortTitle || ""),
      version: Number(doc.version || 1),
      isActive: Boolean(doc.isActive),
    });
  }

  const templates = Array.from(map.values()).sort((a, b) => a.templateId.localeCompare(b.templateId));

  const inspectors = await User.find({
    isDelete: { $ne: true },
    $or: [{ role: "inspector" }, { roles: "inspector" }],
  })
    .select("firstName lastName email role roles userNumber assignedTemplateIds")
    .lean();

  return NextResponse.json({
    inspectors: (inspectors as any[]).map((u) => ({
      _id: String(u._id),
      firstName: String(u.firstName || ""),
      lastName: String(u.lastName || ""),
      email: String(u.email || ""),
      role: String(u.role || "inspector"),
      roles: Array.isArray(u.roles) ? u.roles : undefined,
      userNumber: String(u.userNumber || ""),
      assignedTemplateIds: normalizeTemplateIds(u.assignedTemplateIds),
    })),
    templates,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId || "").trim();
  const templateIds = normalizeTemplateIds(body?.templateIds);

  if (!userId) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  await connectToDatabase();

  const user = await User.findById(userId).lean();
  if (!user || user.isDelete) {
    return NextResponse.json({ error: "Inspector no encontrado" }, { status: 404 });
  }

  if (!hasRole({ role: (user as any).role, roles: (user as any).roles }, "inspector")) {
    return NextResponse.json({ error: "El usuario no tiene rol inspector" }, { status: 400 });
  }

  if (templateIds.length > 0) {
    const validTemplateIds = new Set(
      (await ChecklistTemplate.distinct("templateId", {})).map((x: unknown) => String(x || "").trim()).filter(Boolean),
    );
    const invalid = templateIds.filter((id) => !validTemplateIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `templateIds inválidos: ${invalid.join(", ")}` }, { status: 400 });
    }
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { assignedTemplateIds: templateIds },
    { new: true },
  )
    .select("firstName lastName email role roles assignedTemplateIds")
    .lean();

  return NextResponse.json({
    user: {
      _id: String((updated as any)?._id || userId),
      assignedTemplateIds: normalizeTemplateIds((updated as any)?.assignedTemplateIds),
    },
  });
}


