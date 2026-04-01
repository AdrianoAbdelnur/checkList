import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import { requireRolesSession } from "@/lib/server/auth-next";

type Ctx = { params: Promise<{ id: string }> };

type ReviewStatus = "SIN_REVISION" | "REVISADO";

function normalizeReviewStatus(value: unknown): ReviewStatus | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (["SIN_REVISION", "SIN REVISION", "UNREVIEWED", "NONE"].includes(text)) {
    return "SIN_REVISION";
  }
  if (["REVISADO", "REVIEWED", "DONE", "OK"].includes(text)) {
    return "REVISADO";
  }
  return null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  await connectToDatabase();

  const auth = await requireRolesSession(req, ["admin", "manager", "supervisor"]);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  if (!id) {
    return Response.json({ ok: false, message: "id requerido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const reviewStatus = normalizeReviewStatus((body as Record<string, unknown>)?.reviewStatus);
  if (!reviewStatus) {
    return Response.json(
      { ok: false, message: "reviewStatus invalido. Use SIN_REVISION o REVISADO" },
      { status: 400 }
    );
  }

  const doc = await Checklist.findById(id);
  if (!doc) {
    return Response.json({ ok: false, message: "Checklist no encontrado" }, { status: 404 });
  }

  const currentData = doc.data && typeof doc.data === "object" ? doc.data : {};
  const currentReview = (currentData as Record<string, unknown>).review;
  const reviewObj = currentReview && typeof currentReview === "object" ? (currentReview as Record<string, unknown>) : {};

  doc.set("reviewStatus", reviewStatus);
  doc.set("data.reviewStatus", reviewStatus);
  doc.set("data.review", {
    ...reviewObj,
    status: reviewStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: {
      userId: auth.session.userId,
      email: auth.session.email,
      firstName: auth.session.firstName,
      lastName: auth.session.lastName,
      role: auth.session.role,
    },
  });

  await doc.save();

  return Response.json({
    ok: true,
    item: {
      id: String(doc._id),
      reviewStatus,
    },
  });
}

