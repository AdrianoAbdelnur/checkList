import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import ChecklistTemplate from "@/models/ChecklistTemplate";
import { requireUser } from "@/lib/auth/requireUser";

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId");
  const status = url.searchParams.get("status");
  const plate = url.searchParams.get("plate");

  const q: any = { inspectorId: auth.user._id };
  if (templateId) q.templateId = templateId;
  if (status) q.status = status;
  if (plate) q["data.subject.plate"] = plate;

  const items = await Checklist.find(q).sort({ createdAt: -1 }).lean();
  return Response.json({ ok: true, items });
}

export async function POST(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await req.json();

  const templateId = String(body?.templateId ?? "");
  if (!templateId) {
    return Response.json({ ok: false, message: "templateId requerido" }, { status: 400 });
  }

  let templateVersion = body?.templateVersion ? Number(body.templateVersion) : null;

  if (!templateVersion) {
    const last = await ChecklistTemplate.findOne({ templateId, isActive: true })
      .sort({ version: -1 })
      .lean();

    if (!last) {
      return Response.json({ ok: false, message: "Template no encontrado" }, { status: 404 });
    }

    templateVersion = last.version;
  } else {
    const exists = await ChecklistTemplate.findOne({ templateId, version: templateVersion }).lean();
    if (!exists) {
      return Response.json({ ok: false, message: "Template/version no existe" }, { status: 404 });
    }
  }

  const inspectorSnapshot = {
    id: auth.user._id,
    email: auth.user.email,
    firstName: auth.user.firstName,
    lastName: auth.user.lastName,
    role: auth.user.role,
  };

  const created = await Checklist.create({
    templateId,
    templateVersion,
    inspectorId: auth.user._id,
    inspectorSnapshot,
    data: body?.data ?? {},
    status: "SUBMITTED",
    submittedAt: null,
  });

  return Response.json({ ok: true, item: created }, { status: 201 });
}
