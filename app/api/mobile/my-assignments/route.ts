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

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });

  const url = new URL(req.url);
  const dateKey = normalizeDateKey(url.searchParams.get("date")) || formatTodayKey();

  const trips = await Trip.find({ tripDateKey: dateKey })
    .sort({ dominio: 1, solicitudAt: 1, createdAt: 1 })
    .select("_id dominio tipo tripDateKey")
    .lean();

  const templateDocs = await ChecklistTemplate.find({ isActive: true })
    .sort({ templateId: 1, version: -1 })
    .select("templateId title shortTitle version")
    .lean();

  const latestTemplates = new Map<string, { templateId: string; title: string; shortTitle: string; version: number }>();
  for (const doc of templateDocs as any[]) {
    const templateId = String(doc.templateId || "").trim();
    if (!templateId || latestTemplates.has(templateId)) continue;
    latestTemplates.set(templateId, {
      templateId,
      title: String(doc.title || templateId),
      shortTitle: String(doc.shortTitle || ""),
      version: Number(doc.version || 1),
    });
  }

  const templates = Array.from(latestTemplates.values());

  const items = (trips as any[]).length
    ? (trips as any[]).flatMap((trip) =>
        templates.map((tpl) => ({
          tripId: String(trip._id),
          tripDateKey: String(trip.tripDateKey || ""),
          dominio: String(trip.dominio || "").trim().toUpperCase(),
          tipo: String(trip.tipo || "").trim(),
          templateId: tpl.templateId,
          templateTitle: tpl.title,
          templateShortTitle: tpl.shortTitle,
          templateVersion: tpl.version,
        })),
      )
    : templates.map((tpl) => ({
        tripId: "",
        tripDateKey: dateKey,
        dominio: "",
        tipo: "",
        templateId: tpl.templateId,
        templateTitle: tpl.title,
        templateShortTitle: tpl.shortTitle,
        templateVersion: tpl.version,
      }));

  return Response.json({
    ok: true,
    date: dateKey,
    total: items.length,
    items,
  });
}
