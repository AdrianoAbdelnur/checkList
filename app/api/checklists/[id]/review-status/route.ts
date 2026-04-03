import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Checklist from "@/models/Checklist";
import { requireRolesSession } from "@/lib/server/auth-next";

type Ctx = { params: Promise<{ id: string }> };

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
type ApprovalHistoryItem = {
  status: ApprovalStatus;
  note: string;
  imageUrl: string;
  decidedAt: string;
  decidedBy: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
};

function normalizeApprovalStatus(value: unknown): ApprovalStatus | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (["PENDING", "PENDIENTE", "NONE", "UNREVIEWED", "SIN_REVISION", "SIN REVISION"].includes(text)) {
    return "PENDING";
  }
  if (["APPROVED", "APROBADO", "APROBAR", "OK", "PASS", "REVISADO", "REVIEWED", "DONE"].includes(text)) {
    return "APPROVED";
  }
  if (["REJECTED", "RECHAZADO", "NO_APROBADO", "NO APROBADO", "DENIED", "FAIL"].includes(text)) {
    return "REJECTED";
  }
  return null;
}

function normalizeOptionalText(value: unknown, max = 2000): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function normalizeOptionalUrl(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) return "";
  return text.slice(0, 4000);
}

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeHistoryItem(value: unknown): ApprovalHistoryItem | null {
  const obj = asObj(value);
  const status = normalizeApprovalStatus(obj.status);
  if (!status) return null;
  return {
    status,
    note: normalizeOptionalText(obj.note),
    imageUrl: normalizeOptionalUrl(obj.imageUrl),
    decidedAt: normalizeOptionalText(obj.decidedAt, 80) || new Date().toISOString(),
    decidedBy: {
      userId: normalizeOptionalText(asObj(obj.decidedBy).userId, 200),
      email: normalizeOptionalText(asObj(obj.decidedBy).email, 500),
      firstName: normalizeOptionalText(asObj(obj.decidedBy).firstName, 200),
      lastName: normalizeOptionalText(asObj(obj.decidedBy).lastName, 200),
      role: normalizeOptionalText(asObj(obj.decidedBy).role, 100),
    },
  };
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
  const payload = body as Record<string, unknown>;
  const approvalStatus =
    normalizeApprovalStatus(payload?.approvalStatus) ??
    normalizeApprovalStatus(payload?.reviewStatus);
  const approvalNote = normalizeOptionalText(payload?.approvalNote);
  const approvalImageUrl = normalizeOptionalUrl(payload?.approvalImageUrl);
  if (!approvalStatus) {
    return Response.json(
      { ok: false, message: "approvalStatus invalido. Use APPROVED o REJECTED" },
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
  const currentApproval = (currentData as Record<string, unknown>).approval;
  const approvalObj = currentApproval && typeof currentApproval === "object" ? (currentApproval as Record<string, unknown>) : {};
  const currentApprovalHistoryRaw = (currentData as Record<string, unknown>).approvalHistory;
  const reviewStatus = approvalStatus === "PENDING" ? "SIN_REVISION" : "REVISADO";
  const updatedBy = {
    userId: auth.session.userId,
    email: auth.session.email,
    firstName: auth.session.firstName,
    lastName: auth.session.lastName,
    role: auth.session.role,
  };
  const nowIso = new Date().toISOString();

  const approvalHistory: ApprovalHistoryItem[] = Array.isArray(currentApprovalHistoryRaw)
    ? currentApprovalHistoryRaw.map((item) => normalizeHistoryItem(item)).filter(Boolean) as ApprovalHistoryItem[]
    : [];

  // Preserve legacy single-decision shape if history was never initialized.
  if (approvalHistory.length === 0) {
    const legacyStatus = normalizeApprovalStatus(approvalObj.status);
    if (legacyStatus) {
      approvalHistory.push({
        status: legacyStatus,
        note: normalizeOptionalText(approvalObj.note),
        imageUrl: normalizeOptionalUrl(approvalObj.imageUrl),
        decidedAt: normalizeOptionalText(approvalObj.updatedAt, 80) || nowIso,
        decidedBy: {
          userId: normalizeOptionalText(asObj(approvalObj.updatedBy).userId, 200),
          email: normalizeOptionalText(asObj(approvalObj.updatedBy).email, 500),
          firstName: normalizeOptionalText(asObj(approvalObj.updatedBy).firstName, 200),
          lastName: normalizeOptionalText(asObj(approvalObj.updatedBy).lastName, 200),
          role: normalizeOptionalText(asObj(approvalObj.updatedBy).role, 100),
        },
      });
    }
  }

  const latestApproval: ApprovalHistoryItem = {
    status: approvalStatus,
    note: approvalNote,
    imageUrl: approvalImageUrl,
    decidedAt: nowIso,
    decidedBy: updatedBy,
  };
  approvalHistory.push(latestApproval);

  doc.set("approvalStatus", approvalStatus);
  doc.set("data.approvalStatus", approvalStatus);
  doc.set("data.approval", {
    ...approvalObj,
    status: latestApproval.status,
    note: latestApproval.note,
    imageUrl: latestApproval.imageUrl,
    updatedAt: latestApproval.decidedAt,
    updatedBy: latestApproval.decidedBy,
  });
  doc.set("data.approvalHistory", approvalHistory);

  // Backward compatibility for current review filters and dashboards.
  doc.set("reviewStatus", reviewStatus);
  doc.set("data.reviewStatus", reviewStatus);
  doc.set("data.review", {
    ...reviewObj,
    status: reviewStatus,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });

  await doc.save();

  return Response.json({
    ok: true,
    item: {
      id: String(doc._id),
      approvalStatus,
      approvalNote,
      approvalImageUrl,
      reviewStatus,
      approvalHistoryLength: approvalHistory.length,
    },
  });
}

