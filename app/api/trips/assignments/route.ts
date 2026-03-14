import { connectToDatabase } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { hasAnyRole, hasPermission } from "@/lib/roles";
import Trip from "@/models/Trip";
import ChecklistTemplate from "@/models/ChecklistTemplate";
import User from "@/models/User";

function normalizeDateKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function isAllowed(user: any) {
  return (
    hasPermission(user as any, "checklist.view_all") ||
    hasAnyRole(user as any, ["admin", "supervisor", "reviewer"])
  );
}

function normalizeTemplateIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<string>();
  for (const item of input) {
    const value = String(item ?? "").trim();
    if (value) set.add(value);
  }
  return Array.from(set);
}

function hasInspectorRole(user: any) {
  const role = String(user?.role || "").trim();
  const roles = Array.isArray(user?.roles) ? user.roles.map((x: unknown) => String(x || "").trim()) : [];
  return role === "inspector" || roles.includes("inspector");
}

function normalizeInspectorAssignments(input: unknown): Array<{ templateId: string; inspectorId: string }> {
  const out: Array<{ templateId: string; inspectorId: string }> = [];
  if (Array.isArray(input)) {
    for (const row of input) {
      const templateId = String((row as any)?.templateId || "").trim();
      const inspectorId = String((row as any)?.inspectorId || "").trim();
      if (!templateId || !inspectorId) continue;
      out.push({ templateId, inspectorId });
    }
    return out;
  }

  if (input && typeof input === "object") {
    for (const [templateIdRaw, inspectorIdRaw] of Object.entries(input as Record<string, unknown>)) {
      const templateId = String(templateIdRaw || "").trim();
      const inspectorId = String(inspectorIdRaw || "").trim();
      if (!templateId || !inspectorId) continue;
      out.push({ templateId, inspectorId });
    }
  }
  return out;
}

function toAssignmentMap(input: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of normalizeInspectorAssignments(input)) {
    map[row.templateId] = row.inspectorId;
  }
  return map;
}

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  if (!isAllowed(auth.user)) return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });

  const url = new URL(req.url);
  const date = normalizeDateKey(url.searchParams.get("date"));
  if (!date) {
    return Response.json({ ok: false, message: "date requerido (YYYY-MM-DD)" }, { status: 400 });
  }

  const trips = await Trip.find({ tripDateKey: date })
    .sort({ dominio: 1, solicitudAt: 1, createdAt: 1 })
    .lean();

  const templateDocs = await ChecklistTemplate.find({ isActive: true })
    .sort({ templateId: 1, version: -1 })
    .select("templateId title shortTitle version")
    .lean();

  const map = new Map<string, any>();
  for (const t of templateDocs as any[]) {
    const key = String(t.templateId || "").trim();
    if (!key || map.has(key)) continue;
    map.set(key, {
      templateId: key,
      title: String(t.title || key),
      shortTitle: String((t as any).shortTitle || ""),
      version: Number(t.version || 1),
    });
  }

  const inspectors = await User.find({
    isDelete: { $ne: true },
    $or: [{ role: "inspector" }, { roles: "inspector" }],
  })
    .sort({ firstName: 1, lastName: 1, email: 1 })
    .select("firstName lastName email role roles inspectorNumber assignedTemplateIds")
    .lean();

  return Response.json({
    ok: true,
    trips: (trips as any[]).map((trip) => ({
      _id: String(trip._id),
      dominio: String(trip.dominio || "").trim().toUpperCase(),
      tripDateKey: String(trip.tripDateKey || ""),
      solicitudAt: trip.solicitudAt || null,
      tipo: String(trip.tipo || ""),
      assignedTemplateIds: normalizeTemplateIds(trip.assignedTemplateIds),
      assignedInspectorByTemplate: toAssignmentMap((trip as any).assignedInspectorAssignments),
    })),
    templates: Array.from(map.values()),
    inspectors: (inspectors as any[]).map((u) => ({
      _id: String(u._id),
      firstName: String(u.firstName || "").trim(),
      lastName: String(u.lastName || "").trim(),
      email: String(u.email || "").trim().toLowerCase(),
      inspectorNumber: String(u.inspectorNumber || "").trim(),
      assignedTemplateIds: normalizeTemplateIds(u.assignedTemplateIds),
      isInspector: hasInspectorRole(u),
    })),
  });
}

export async function PATCH(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  if (!isAllowed(auth.user)) return Response.json({ ok: false, message: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const tripId = String(body?.tripId || "").trim();
  const templateIdsFromBody = normalizeTemplateIds(body?.templateIds);
  const requestedAssignments = normalizeInspectorAssignments(body?.inspectorAssignments);

  if (!tripId) {
    return Response.json({ ok: false, message: "tripId requerido" }, { status: 400 });
  }

  const validTemplateIds = new Set(
    (await ChecklistTemplate.distinct("templateId", { isActive: true }))
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean),
  );

  const invalid = templateIdsFromBody.filter((id) => !validTemplateIds.has(id));
  if (invalid.length > 0) {
    return Response.json({ ok: false, message: `templateIds invalidos: ${invalid.join(", ")}` }, { status: 400 });
  }

  let templateIds = templateIdsFromBody;
  let normalizedAssignments: Array<{ templateId: string; inspectorId: string }> = [];
  const hasInspectorAssignmentsPayload = body?.inspectorAssignments !== undefined;

  if (requestedAssignments.length > 0 || hasInspectorAssignmentsPayload) {
    const invalidTemplates = requestedAssignments
      .map((x) => x.templateId)
      .filter((id) => !validTemplateIds.has(id));
    if (invalidTemplates.length > 0) {
      return Response.json({ ok: false, message: `templateIds invalidos: ${Array.from(new Set(invalidTemplates)).join(", ")}` }, { status: 400 });
    }

    const inspectorIds = Array.from(new Set(requestedAssignments.map((x) => x.inspectorId)));
    const inspectors = await User.find({
      _id: { $in: inspectorIds },
      isDelete: { $ne: true },
      $or: [{ role: "inspector" }, { roles: "inspector" }],
    })
      .select("_id assignedTemplateIds role roles")
      .lean();

    const inspectorMap = new Map<string, any>();
    for (const inspector of inspectors as any[]) {
      inspectorMap.set(String(inspector._id), inspector);
    }

    for (const row of requestedAssignments) {
      const inspector = inspectorMap.get(row.inspectorId);
      if (!inspector) {
        return Response.json({ ok: false, message: `Inspector inválido para ${row.templateId}` }, { status: 400 });
      }

      const inspectorTemplates = normalizeTemplateIds((inspector as any).assignedTemplateIds);
      if (!inspectorTemplates.includes(row.templateId)) {
        return Response.json(
          { ok: false, message: `El inspector asignado no tiene habilitado el checklist ${row.templateId}` },
          { status: 400 },
        );
      }
    }

    const dedup = new Map<string, string>();
    for (const row of requestedAssignments) dedup.set(row.templateId, row.inspectorId);
    normalizedAssignments = Array.from(dedup.entries()).map(([templateId, inspectorId]) => ({ templateId, inspectorId }));
    templateIds = Array.from(new Set(normalizedAssignments.map((x) => x.templateId)));
  }

  const updatePayload: Record<string, unknown> = { assignedTemplateIds: templateIds };
  if (hasInspectorAssignmentsPayload) {
    updatePayload.assignedInspectorAssignments = normalizedAssignments;
  }

  const updated = await Trip.findByIdAndUpdate(tripId, updatePayload, { new: true })
    .select("_id assignedTemplateIds assignedInspectorAssignments")
    .lean();

  if (!updated) {
    return Response.json({ ok: false, message: "Viaje no encontrado" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    trip: {
      _id: String((updated as any)._id),
      assignedTemplateIds: normalizeTemplateIds((updated as any).assignedTemplateIds),
      assignedInspectorByTemplate: toAssignmentMap((updated as any).assignedInspectorAssignments),
    },
  });
}
