import { connectToDatabase } from "@/lib/db";
import ChecklistTemplate from "@/models/ChecklistTemplate";

type Ctx = { params: Promise<{ templateId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  await connectToDatabase();
  const { templateId } = await ctx.params;

  const items = await ChecklistTemplate.find({ templateId }).sort({ version: -1 }).lean();
  return Response.json({ ok: true, items });
}

export async function POST(req: Request, ctx: Ctx) {
  await connectToDatabase();
  const { templateId } = await ctx.params;
  const body = await req.json();

  const title = String(body?.title ?? "");
  const sections = body?.sections;

  if (!title) return Response.json({ ok: false, message: "title requerido" }, { status: 400 });
  if (!sections) return Response.json({ ok: false, message: "sections requerido" }, { status: 400 });

  const last = await ChecklistTemplate.findOne({ templateId }).sort({ version: -1 }).lean();
  const nextVersion = (last?.version ?? 0) + 1;

  const created = await ChecklistTemplate.create({
    templateId,
    version: nextVersion,
    title,
    sections,
    isActive: true,
  });

  return Response.json({ ok: true, item: created }, { status: 201 });
}
