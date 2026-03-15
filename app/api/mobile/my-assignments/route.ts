import { connectToDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import Trip from "@/models/Trip";
import ChecklistTemplate from "@/models/ChecklistTemplate";

function formatTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDateKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function normalizeAssignments(input: unknown): Array<{ templateId: string; inspectorId: string }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => ({
      templateId: String((row as any)?.templateId || "").trim(),
      inspectorId: String((row as any)?.inspectorId || "").trim(),
    }))
    .filter((row) => row.templateId && row.inspectorId);
}

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });

  const url = new URL(req.url);
  const dateKey = normalizeDateKey(url.searchParams.get("date")) || formatTodayKey();
  const userId = String((auth.user as any)?._id || "").trim();
  if (!userId) {
    return Response.json({ ok: false, message: "Usuario inválido" }, { status: 401 });
  }

  const trips = await Trip.find({
    tripDateKey: dateKey,
    assignedInspectorAssignments: { $elemMatch: { inspectorId: userId } },
  })
    .sort({ dominio: 1, solicitudAt: 1, createdAt: 1 })
    .select("_id dominio tipo tripDateKey assignedInspectorAssignments")
    .lean();

  const allTemplateIds = Array.from(
    new Set(
      (trips as any[]).flatMap((trip) =>
        normalizeAssignments((trip as any).assignedInspectorAssignments).map((x) => x.templateId),
      ),
    ),
  );

  const templateDocs = allTemplateIds.length
    ? await ChecklistTemplate.find({ isActive: true, templateId: { $in: allTemplateIds } })
        .sort({ templateId: 1, version: -1 })
        .select("templateId title shortTitle version")
        .lean()
    : [];

  const latestByTemplate = new Map<string, { title: string; shortTitle: string; version: number }>();
  for (const t of templateDocs as any[]) {
    const key = String(t.templateId || "").trim();
    if (!key || latestByTemplate.has(key)) continue;
    latestByTemplate.set(key, {
      title: String(t.title || key),
      shortTitle: String(t.shortTitle || ""),
      version: Number(t.version || 1),
    });
  }

  const items = (trips as any[]).flatMap((trip) => {
    const assignments = normalizeAssignments((trip as any).assignedInspectorAssignments).filter(
      (x) => x.inspectorId === userId,
    );
    return assignments.map((assignment) => {
      const tpl = latestByTemplate.get(assignment.templateId);
      return {
        tripId: String(trip._id),
        tripDateKey: String(trip.tripDateKey || ""),
        dominio: String(trip.dominio || "").trim().toUpperCase(),
        tipo: String(trip.tipo || "").trim(),
        templateId: assignment.templateId,
        templateTitle: tpl?.title || assignment.templateId,
        templateShortTitle: tpl?.shortTitle || "",
        templateVersion: tpl?.version || 1,
      };
    });
  });

  return Response.json({
    ok: true,
    date: dateKey,
    total: items.length,
    items,
  });
}

