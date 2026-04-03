type AnyObj = Record<string, unknown>;

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asObj(value: unknown): AnyObj {
  return value && typeof value === "object" ? (value as AnyObj) : {};
}

function getIn(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    const obj = asObj(current);
    current = obj[key];
    if (current === undefined || current === null) return current;
  }
  return current;
}

export function normalizeChecklistText(value: unknown) {
  return asText(value).toUpperCase();
}

export function getChecklistInspectorLabel(item: AnyObj) {
  const inspector = asObj(getIn(item, ["inspectorId"]));
  const snapshot = asObj(getIn(item, ["inspectorSnapshot"]));
  const first = getIn(inspector, ["firstName"]) ?? getIn(snapshot, ["firstName"]);
  const last = getIn(inspector, ["lastName"]) ?? getIn(snapshot, ["lastName"]);
  const email = getIn(inspector, ["email"]) ?? getIn(snapshot, ["email"]);
  const fullName = [asText(first), asText(last)].filter(Boolean).join(" ").trim();
  return fullName || asText(email) || "Inspector sin nombre";
}

export function getChecklistInspectorRole(item: AnyObj) {
  const role = getIn(item, ["inspectorId", "role"]) ?? getIn(item, ["inspectorSnapshot", "role"]);
  return asText(role) || "-";
}

export function getChecklistPlate(item: AnyObj) {
  return (
    getIn(item, ["data", "subject", "plate"]) ??
    getIn(item, ["data", "vehicle", "plate"]) ??
    getIn(item, ["data", "plate"]) ??
    getIn(item, ["subject", "plate"]) ??
    null
  );
}

export function getChecklistTemplateId(item: AnyObj) {
  return (
    getIn(item, ["templateId"]) ??
    getIn(item, ["template", "templateId"]) ??
    getIn(item, ["data", "templateId"]) ??
    null
  );
}

export function getChecklistVisibility(item: AnyObj) {
  const raw =
    getIn(item, ["visibility"]) ??
    getIn(item, ["visibilidad"]) ??
    getIn(item, ["data", "visibility"]) ??
    getIn(item, ["data", "visibilidad"]) ??
    getIn(item, ["data", "meta", "visibility"]) ??
    getIn(item, ["data", "meta", "visibilidad"]);

  if (typeof raw === "boolean") return raw ? "Publico" : "Privado";
  return asText(raw) || "Interno";
}

export function getChecklistDecision(item: AnyObj) {
  const rawCandidates = [
    getIn(item, ["approvalStatus"]),
    getIn(item, ["reviewStatus"]),
    getIn(item, ["decision"]),
    getIn(item, ["result"]),
    getIn(item, ["data", "approvalStatus"]),
    getIn(item, ["data", "reviewStatus"]),
    getIn(item, ["data", "decision"]),
    getIn(item, ["data", "result"]),
    getIn(item, ["data", "approval", "status"]),
    getIn(item, ["data", "approval", "decision"]),
    getIn(item, ["data", "review", "status"]),
    getIn(item, ["data", "review", "decision"]),
  ];

  for (const candidate of rawCandidates) {
    const text = normalizeChecklistText(candidate);
    if (!text) continue;
    if (["APPROVED", "APROBADO", "OK", "PASS"].includes(text)) return "APPROVED" as const;
    if (["REJECTED", "RECHAZADO", "FAIL", "DENIED"].includes(text)) return "REJECTED" as const;
    if (["PENDING", "PENDIENTE", "UNDER_REVIEW"].includes(text)) return "PENDING" as const;
  }

  if (getIn(item, ["approved"]) === true || getIn(item, ["data", "approved"]) === true) {
    return "APPROVED" as const;
  }
  if (getIn(item, ["rejected"]) === true || getIn(item, ["data", "rejected"]) === true) {
    return "REJECTED" as const;
  }
  return null;
}

export function getChecklistDecisionLabel(item: AnyObj) {
  const decision = getChecklistDecision(item);
  if (decision === "APPROVED") return "Aprobado";
  if (decision === "REJECTED") return "Rechazado";
  if (decision === "PENDING") return "Pendiente";
  return "Sin decision";
}

export function getChecklistReviewStatus(item: AnyObj) {
  const rawCandidates = [
    getIn(item, ["reviewStatus"]),
    getIn(item, ["data", "reviewStatus"]),
    getIn(item, ["review", "status"]),
    getIn(item, ["data", "review", "status"]),
  ];

  for (const candidate of rawCandidates) {
    const text = normalizeChecklistText(candidate);
    if (!text) continue;
    if (["REVISADO", "REVIEWED", "DONE", "OK"].includes(text)) return "REVISADO" as const;
    if (["SIN_REVISION", "SIN REVISION", "UNREVIEWED", "NONE", "PENDING"].includes(text)) {
      return "SIN_REVISION" as const;
    }
  }

  return "SIN_REVISION" as const;
}

export function getChecklistReviewStatusLabel(item: AnyObj) {
  return getChecklistReviewStatus(item) === "REVISADO" ? "Revisado" : "Sin revision";
}

export function formatChecklistDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
