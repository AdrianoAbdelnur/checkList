type AnyObj = Record<string, any>;

function asText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeChecklistText(value: unknown) {
  return asText(value).toUpperCase();
}

export function getChecklistInspectorLabel(item: AnyObj) {
  const inspector = item?.inspectorId;
  const first = inspector?.firstName ?? item?.inspectorSnapshot?.firstName;
  const last = inspector?.lastName ?? item?.inspectorSnapshot?.lastName;
  const email = inspector?.email ?? item?.inspectorSnapshot?.email;
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  return fullName || email || "Inspector sin nombre";
}

export function getChecklistInspectorRole(item: AnyObj) {
  return item?.inspectorId?.role ?? item?.inspectorSnapshot?.role ?? "—";
}

export function getChecklistPlate(item: AnyObj) {
  return (
    item?.data?.subject?.plate ??
    item?.data?.vehicle?.plate ??
    item?.data?.plate ??
    item?.subject?.plate ??
    null
  );
}

export function getChecklistVisibility(item: AnyObj) {
  const raw =
    item?.visibility ??
    item?.visibilidad ??
    item?.data?.visibility ??
    item?.data?.visibilidad ??
    item?.data?.meta?.visibility ??
    item?.data?.meta?.visibilidad;

  if (typeof raw === "boolean") return raw ? "Público" : "Privado";
  return asText(raw) || "Interno";
}

export function getChecklistDecision(item: AnyObj) {
  const rawCandidates = [
    item?.approvalStatus,
    item?.reviewStatus,
    item?.decision,
    item?.result,
    item?.data?.approvalStatus,
    item?.data?.reviewStatus,
    item?.data?.decision,
    item?.data?.result,
    item?.data?.approval?.status,
    item?.data?.approval?.decision,
    item?.data?.review?.status,
    item?.data?.review?.decision,
  ];

  for (const candidate of rawCandidates) {
    const text = normalizeChecklistText(candidate);
    if (!text) continue;
    if (["APPROVED", "APROBADO", "OK", "PASS"].includes(text)) return "APPROVED" as const;
    if (["REJECTED", "RECHAZADO", "FAIL", "DENIED"].includes(text)) return "REJECTED" as const;
    if (["PENDING", "PENDIENTE", "UNDER_REVIEW"].includes(text)) return "PENDING" as const;
  }

  if (item?.approved === true || item?.data?.approved === true) return "APPROVED" as const;
  if (item?.rejected === true || item?.data?.rejected === true) return "REJECTED" as const;
  return null;
}

export function getChecklistDecisionLabel(item: AnyObj) {
  const decision = getChecklistDecision(item);
  if (decision === "APPROVED") return "Aprobado";
  if (decision === "REJECTED") return "Rechazado";
  if (decision === "PENDING") return "Pendiente";
  return "Sin revisión";
}

export function formatChecklistDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
