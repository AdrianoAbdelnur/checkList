import { connectToDatabase } from "@/lib/db";
import ChecklistTemplate from "@/models/ChecklistTemplate";

export async function GET() {
  await connectToDatabase();

  const docs = await ChecklistTemplate.find({ isActive: true })
    .sort({ templateId: 1, version: -1 })
    .lean();

  const map = new Map<string, any>();
  for (const d of docs) {
    if (!map.has(d.templateId)) map.set(d.templateId, d);
  }

  const items = Array.from(map.values()).sort((a, b) => a.templateId.localeCompare(b.templateId));
  return Response.json({ ok: true, items });
}
