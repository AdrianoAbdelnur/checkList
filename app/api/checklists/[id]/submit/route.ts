import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import { requireUser } from "@/lib/auth/requireUser";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  await connectToDatabase();
  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await ctx.params;

  const doc = await Checklist.findById(id);
  if (!doc) return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  const isOwner = String(doc.inspectorId) === String(auth.user._id);
  const canApproveReject = hasPermission(auth.user as any, "checklist.approve_reject");
  if (!isOwner && !canApproveReject) {
    return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });
  }
  if (doc.status !== "DRAFT") return Response.json({ ok: false, message: "Ya enviado" }, { status: 409 });

  doc.status = "SUBMITTED";
  doc.submittedAt = new Date();
  await doc.save();

  return Response.json({ ok: true, item: doc.toObject() });
}

