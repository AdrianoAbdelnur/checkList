"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import { hasAnyRole, ROLE_OPTIONS_ES, roleLabelEs } from "@/lib/roles";
import styles from "./page.module.css";

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
};

type FieldOption = {
  value: string;
  label: string;
  tone?: string;
  comments?: string[];
  [key: string]: unknown;
};
type TemplateField = {
  id: string;
  kind: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  multiline?: boolean;
  min?: number;
  max?: number;
  maxSelected?: number;
  visibleWhen?: Array<{ fieldId: string; equals?: unknown; notEquals?: unknown }>;
  showCamera?: boolean;
  requireObsWhenBad?: boolean;
  requireObsWhenValues?: string[];
  badValues?: string[];
  options?: FieldOption[];
  [key: string]: unknown;
};
type TemplateSection = {
  id: string;
  title: string;
  description?: string;
  isMain?: boolean;
  fields: TemplateField[];
  [key: string]: unknown;
};

type TemplateListItem = {
  _id?: string;
  id?: string;
  templateId: string;
  version: number;
  title: string;
  shortTitle?: string;
  isActive?: boolean;
  sections?: TemplateSection[];
  metrics?: AnyObj[];
  rules?: AnyObj[];
  createdAt?: string;
  updatedAt?: string;
};

type EditorTemplate = {
  id?: string;
  templateId: string;
  version?: number;
  title: string;
  shortTitle?: string;
  isActive: boolean;
  sections: TemplateSection[];
  metrics: AnyObj[];
  rules: AnyObj[];
  [key: string]: unknown;
};

type AnyObj = Record<string, any>;
type EditionMode = "visual" | "file" | "json";

const FIELD_KINDS = [
  "text",
  "number",
  "date",
  "time",
  "yesNo",
  "triStatus",
  "note",
  "select",
  "radioGroup",
  "multiSelect",
  "signature",
] as const;

const DEFAULT_FIELD_KIND = "text";
const FIELD_KIND_LABELS_ES: Record<(typeof FIELD_KINDS)[number], string> = {
  text: "Texto",
  number: "Numero",
  date: "Fecha",
  time: "Hora",
  yesNo: "Si / No",
  triStatus: "Estado (3 opciones)",
  note: "Nota",
  select: "Seleccion simple",
  radioGroup: "Grupo de radio",
  multiSelect: "Seleccion multiple",
  signature: "Firma",
};

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyField(kind = DEFAULT_FIELD_KIND): TemplateField {
  return {
    id: makeId("field"),
    kind,
    label: "",
    required: false,
    placeholder: "",
    description: "",
    ...(kind === "select" || kind === "multiSelect" || kind === "radioGroup"
      ? { options: [{ value: "opcion_1", label: "Opcion 1" }] }
      : {}),
  };
}

function createEmptySection(): TemplateSection {
  return {
    id: makeId("section"),
    title: "",
    description: "",
    fields: [createEmptyField()],
  };
}

function createEmptyTemplate(): EditorTemplate {
  return {
    id: "",
    templateId: "",
    title: "",
    shortTitle: "",
    isActive: true,
    sections: [createEmptySection()],
    metrics: [],
    rules: [],
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function fullName(user: SessionUser | null) {
  if (!user) return "Usuario";
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function parseOptionsInput(value: string): FieldOption[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [v, ...rest] = line.split("|");
      const rawValue = (v || "").trim() || `opcion_${idx + 1}`;
      const label = (rest.join("|").trim() || rawValue).trim();
      return { value: rawValue, label };
    });
}

function optionsToText(options?: FieldOption[]) {
  return (options || []).map((o) => `${o.value}|${o.label}`).join("\n");
}

function getFieldKindLabelEs(kind: string) {
  return FIELD_KIND_LABELS_ES[kind as keyof typeof FIELD_KIND_LABELS_ES] || kind;
}

function slugifyTemplateId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function buildGeneratedSections(sections: TemplateSection[], mode: "create" | "edit"): TemplateSection[] {
  const usedSectionIds = new Set<string>();

  return sections.map((section, sectionIndex) => {
    const sectionBase = slugifyTemplateId(section.title) || `seccion_${sectionIndex + 1}`;
    let sectionId = String(section.id || "").trim() || `section_${sectionBase}`;

    let sectionSuffix = 2;
    while (usedSectionIds.has(sectionId)) {
      sectionId = `section_${sectionBase}_${sectionSuffix++}`;
    }
    usedSectionIds.add(sectionId);

    const usedFieldIds = new Set<string>();
    const fields = section.fields.map((field, fieldIndex) => {
      const fieldBase = slugifyTemplateId(field.label) || `campo_${fieldIndex + 1}`;
      let fieldId = String(field.id || "").trim() || fieldBase;

      let fieldSuffix = 2;
      while (usedFieldIds.has(fieldId)) {
        fieldId = `${fieldBase}_${fieldSuffix++}`;
      }
      usedFieldIds.add(fieldId);

      return { ...field, id: fieldId };
    });

    return { ...section, id: sectionId, fields };
  });
}

function asRecord(value: unknown): AnyObj {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AnyObj;
  }
  throw new Error("El JSON debe ser un objeto");
}

function normalizeImportedField(raw: unknown, sectionIndex: number, fieldIndex: number): TemplateField {
  const obj = asRecord(raw);
  const kind = String(obj.kind || DEFAULT_FIELD_KIND);
  const normalized: TemplateField = {
    ...obj,
    id: String(obj.id || makeId(`field_${sectionIndex + 1}_${fieldIndex + 1}`)),
    kind,
    label: String(obj.label || `Campo ${fieldIndex + 1}`),
    required: Boolean(obj.required),
    placeholder: String(obj.placeholder || ""),
    description: String(obj.description || ""),
  };

  if (kind === "triStatus") {
    normalized.requireObsWhenBad = Boolean(obj.requireObsWhenBad);
  }

  if (kind === "select" || kind === "multiSelect" || kind === "radioGroup") {
    const options = Array.isArray(obj.options) ? obj.options : [];
    normalized.options = options.length
      ? options.map((option, idx) => {
        const opt = asRecord(option);
          const value = String(opt.value || `opcion_${idx + 1}`);
          return {
            ...opt,
            value,
            label: String(opt.label || value),
            comments: Array.isArray(opt.comments) ? opt.comments.map((x) => String(x)) : undefined,
            tone: opt.tone !== undefined ? String(opt.tone) : undefined,
          };
        })
      : [{ value: "opcion_1", label: "Opcion 1" }];
  }

  if (Array.isArray(obj.requireObsWhenValues)) {
    normalized.requireObsWhenValues = obj.requireObsWhenValues.map((x: unknown) => String(x));
  }

  if (Array.isArray(obj.badValues)) {
    normalized.badValues = obj.badValues.map((x: unknown) => String(x));
  }

  if (Array.isArray(obj.visibleWhen)) {
    normalized.visibleWhen = obj.visibleWhen
      .map((rule: unknown) => {
        const r = asRecord(rule);
        if (!r.fieldId) return null;
        return {
          fieldId: String(r.fieldId),
          equals: r.equals,
          notEquals: r.notEquals,
        };
      })
      .filter(Boolean) as Array<{ fieldId: string; equals?: unknown; notEquals?: unknown }>;
  }

  if (obj.showCamera !== undefined) {
    normalized.showCamera = Boolean(obj.showCamera);
  }

  return normalized;
}

function normalizeImportedTemplate(raw: unknown): EditorTemplate {
  const root = asRecord(raw);
  const source = root.item && typeof root.item === "object" ? asRecord(root.item) : root;

  const title = String(source.title || "").trim();
  const shortTitle = String((source as any).shortTitle || (source as any).shortTible || "").trim();
  const templateId = String(source.templateId || source.id || slugifyTemplateId(title)).trim();
  const sectionsRaw = Array.isArray(source.sections) ? source.sections : [];

  if (!title) throw new Error("El JSON debe incluir 'title'");
  if (!templateId) throw new Error("El JSON debe incluir 'templateId' o 'id'");
  if (!sectionsRaw.length) throw new Error("El JSON debe incluir al menos una seccion en 'sections'");

  const sections: TemplateSection[] = sectionsRaw.map((sectionRaw, sectionIndex) => {
    const sectionObj = asRecord(sectionRaw);
    const fieldsRaw = Array.isArray(sectionObj.fields) ? sectionObj.fields : [];
    if (!fieldsRaw.length) {
      throw new Error(`La seccion ${sectionIndex + 1} debe incluir al menos un campo`);
    }

    return {
      ...sectionObj,
      id: String(sectionObj.id || makeId(`section_${sectionIndex + 1}`)),
      title: String(sectionObj.title || `Seccion ${sectionIndex + 1}`),
      description: String(sectionObj.description || ""),
      isMain: sectionObj.isMain !== undefined ? Boolean(sectionObj.isMain) : undefined,
      fields: fieldsRaw.map((fieldRaw, fieldIndex) =>
        normalizeImportedField(fieldRaw, sectionIndex, fieldIndex)
      ),
    };
  });

  return {
    ...source,
    id: String(source.id || templateId),
    templateId,
    version: Number.isFinite(Number(source.version)) ? Number(source.version) : undefined,
    title,
    shortTitle,
    isActive: source.isActive !== undefined ? Boolean(source.isActive) : true,
    sections,
    metrics: Array.isArray(source.metrics) ? deepClone(source.metrics) : [],
    rules: Array.isArray(source.rules) ? deepClone(source.rules) : [],
  };
}

export default function TemplateEditorPage() {
  const router = useRouter();
  const jsonFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [versions, setVersions] = React.useState<TemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [selectedVersion, setSelectedVersion] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editor, setEditor] = React.useState<EditorTemplate>(createEmptyTemplate());
  const [jsonTextToImport, setJsonTextToImport] = React.useState("");
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [editionMode, setEditionMode] = React.useState<EditionMode>("visual");

  const isVisualMode = editionMode === "visual";
  const isFileMode = editionMode === "file";
  const isJsonMode = editionMode === "json";

  const canEditTemplates = hasAnyRole(me as any, ["admin"]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedMode = String(new URLSearchParams(window.location.search).get("mode") || "visual").toLowerCase();
    setEditionMode(requestedMode === "file" || requestedMode === "json" ? requestedMode : "visual");
  }, []);

  const loadLatestTemplates = React.useCallback(async () => {
    const res = await fetch("/api/templates", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) throw new Error(data?.message || "Error al listar templates");
    setTemplates(Array.isArray(data.items) ? data.items : []);
  }, []);

  const loadVersions = React.useCallback(async (templateId: string) => {
    const res = await fetch(`/api/templates/${templateId}/versions`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) throw new Error(data?.message || "Error al listar versiones");
    const items = Array.isArray(data.items) ? data.items : [];
    setVersions(items);
    return items;
  }, []);

  const loadTemplateVersion = React.useCallback(async (templateId: string, version: number) => {
    const res = await fetch(`/api/templates/${templateId}/versions/${version}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) throw new Error(data?.message || "Error al cargar template");
    const item = data.item as TemplateListItem | undefined;
    if (!item) throw new Error("Template invalido");

    setEditor({
      id: String(item.id || item.templateId || templateId),
      templateId: item.templateId || templateId,
      version: item.version,
      title: item.title || "",
      shortTitle: String((item as any).shortTitle || ""),
      isActive: item.isActive ?? true,
      sections:
        Array.isArray(item.sections) && item.sections.length
          ? deepClone(item.sections)
          : [createEmptySection()],
      metrics: Array.isArray(item.metrics) ? deepClone(item.metrics) : [],
      rules: Array.isArray(item.rules) ? deepClone(item.rules) : [],
    });
    setMode("edit");
    setSelectedTemplateId(templateId);
    setSelectedVersion(version);
    setIsEditorOpen(true);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        const meJson = await meRes.json().catch(() => ({}));
        if (!meRes.ok || !meJson?.user) {
          router.push("/login");
          return;
        }
        if (!hasAnyRole(meJson.user as any, ["admin"])) {
          router.push("/dashboard");
          return;
        }
        if (cancelled) return;
        setMe(meJson.user);
        await loadLatestTemplates();
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Error al iniciar editor");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadLatestTemplates, router]);

  function updateEditor<K extends keyof EditorTemplate>(key: K, value: EditorTemplate[K]) {
    setEditor((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "title" && mode === "create") {
        if (!String(next.templateId || "").trim()) {
          next.templateId = slugifyTemplateId(String(value));
        }
        if (!String(next.id || "").trim()) {
          next.id = next.templateId;
        }
      }

      return next;
    });
  }

  function updateSection(index: number, patch: Partial<TemplateSection>) {
    setEditor((prev) => {
      const sections = [...prev.sections];
      sections[index] = { ...sections[index], ...patch };
      return { ...prev, sections };
    });
  }

  function updateField(sectionIndex: number, fieldIndex: number, patch: Partial<TemplateField>) {
    setEditor((prev) => {
      const sections = [...prev.sections];
      const section = { ...sections[sectionIndex] };
      const fields = [...section.fields];
      const current = { ...fields[fieldIndex], ...patch };
      if (current.kind !== "select" && current.kind !== "multiSelect" && current.kind !== "radioGroup") {
        delete current.options;
      }
      if (
        (current.kind === "select" || current.kind === "multiSelect" || current.kind === "radioGroup") &&
        !current.options
      ) {
        current.options = [{ value: "opcion_1", label: "Opcion 1" }];
      }
      fields[fieldIndex] = current;
      section.fields = fields;
      sections[sectionIndex] = section;
      return { ...prev, sections };
    });
  }

  function addSection() {
    setEditor((prev) => ({ ...prev, sections: [...prev.sections, createEmptySection()] }));
  }

  function removeSection(index: number) {
    setEditor((prev) => {
      const sections = prev.sections.filter((_, i) => i !== index);
      return { ...prev, sections: sections.length ? sections : [createEmptySection()] };
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    setEditor((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.sections.length) return prev;
      const sections = [...prev.sections];
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      return { ...prev, sections };
    });
  }

  function addField(sectionIndex: number, kind = DEFAULT_FIELD_KIND) {
    setEditor((prev) => {
      const sections = [...prev.sections];
      const section = { ...sections[sectionIndex] };
      section.fields = [...section.fields, createEmptyField(kind)];
      sections[sectionIndex] = section;
      return { ...prev, sections };
    });
  }

  function removeField(sectionIndex: number, fieldIndex: number) {
    setEditor((prev) => {
      const sections = [...prev.sections];
      const section = { ...sections[sectionIndex] };
      const fields = section.fields.filter((_, i) => i !== fieldIndex);
      section.fields = fields.length ? fields : [createEmptyField()];
      sections[sectionIndex] = section;
      return { ...prev, sections };
    });
  }

  function moveField(sectionIndex: number, fieldIndex: number, direction: -1 | 1) {
    setEditor((prev) => {
      const sections = [...prev.sections];
      const section = { ...sections[sectionIndex] };
      const nextIndex = fieldIndex + direction;
      if (nextIndex < 0 || nextIndex >= section.fields.length) return prev;
      const fields = [...section.fields];
      [fields[fieldIndex], fields[nextIndex]] = [fields[nextIndex], fields[fieldIndex]];
      section.fields = fields;
      sections[sectionIndex] = section;
      return { ...prev, sections };
    });
  }

  async function handleSelectTemplate(templateId: string) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const items = await loadVersions(templateId);
      if (items.length) {
        await loadTemplateVersion(templateId, items[0].version);
      } else {
        setSelectedTemplateId(templateId);
        setSelectedVersion(null);
        setMode("create");
        setEditor({ ...createEmptyTemplate(), templateId });
        setIsEditorOpen(true);
      }
    } catch (e: any) {
      setError(e.message || "Error al cargar template");
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectVersion(version: number) {
    if (!selectedTemplateId) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await loadTemplateVersion(selectedTemplateId, version);
    } catch (e: any) {
      setError(e.message || "Error al cargar version");
    } finally {
      setBusy(false);
    }
  }

  function startNewTemplate() {
    setMode("create");
    setSelectedTemplateId("");
    setSelectedVersion(null);
    setVersions([]);
    setEditor(createEmptyTemplate());
    setError(null);
    setSuccess(null);
    setIsEditorOpen(true);
  }

  function cloneAsNewVersion() {
    setMode("create");
    setSelectedVersion(null);
    setSuccess(null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setMode("create");
    setSelectedVersion(null);
    setError(null);
    setSuccess(null);
  }

  async function createTemplateVersionFromImport(imported: EditorTemplate) {
    setError(null);
    setSuccess(null);
    setImporting(true);

    try {
    const resolvedTemplateId = imported.templateId.trim();
    const payloadToSend = {
      id: imported.id || resolvedTemplateId,
      templateId: resolvedTemplateId,
      title: imported.title.trim(),
      shortTitle: String(imported.shortTitle || "").trim() || undefined,
      isActive: imported.isActive,
      sections: buildGeneratedSections(imported.sections, "create"),
      metrics: Array.isArray(imported.metrics) ? imported.metrics : [],
      rules: Array.isArray(imported.rules) ? imported.rules : [],
    };

      const res = await fetch(`/api/templates/${encodeURIComponent(resolvedTemplateId)}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || data?.error || "No se pudo importar JSON");
      }

      setImportModalOpen(true);
    } finally {
      setImporting(false);
    }
  }

  async function applyImportedTemplate(imported: EditorTemplate) {
    if (!isVisualMode) {
      await createTemplateVersionFromImport(imported);
      return;
    }

    setEditor(imported);
    setSelectedTemplateId(imported.templateId);
    setSelectedVersion(null);
    setMode("create");
    setIsEditorOpen(true);
    setError(null);
    setSuccess("JSON cargado en el editor. Revisa y guarda para crear una nueva version.");
  }

  async function handleJsonFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const imported = normalizeImportedTemplate(parsed);
      await applyImportedTemplate(imported);
    } catch (e: any) {
      setError(e?.message || "No se pudo importar el archivo JSON");
      setSuccess(null);
    } finally {
      event.target.value = "";
    }
  }

  async function handleImportFromTextarea() {
    setError(null);
    setSuccess(null);

    if (!jsonTextToImport.trim()) {
      setError("Pega un JSON antes de importar");
      return;
    }

    try {
      const parsed = JSON.parse(jsonTextToImport);
      const imported = normalizeImportedTemplate(parsed);
      await applyImportedTemplate(imported);
    } catch (e: any) {
      setError(e?.message || "JSON invalido");
    }
  }

  async function saveTemplate() {
    setError(null);
    setSuccess(null);
    const resolvedTemplateId = (editor.templateId.trim() || slugifyTemplateId(editor.title)).trim();

    if (!resolvedTemplateId) return setError("El identificador del template es obligatorio");
    if (!editor.title.trim()) return setError("El titulo es obligatorio");

    if (resolvedTemplateId !== editor.templateId) {
      setEditor((prev) => ({ ...prev, templateId: resolvedTemplateId }));
    }

    const payloadToSend = {
      id: editor.id || resolvedTemplateId,
      templateId: resolvedTemplateId,
      title: editor.title.trim(),
      shortTitle: String(editor.shortTitle || "").trim() || undefined,
      isActive: editor.isActive,
      sections: buildGeneratedSections(editor.sections, mode),
      metrics: Array.isArray(editor.metrics) ? editor.metrics : [],
      rules: Array.isArray(editor.rules) ? editor.rules : [],
    };

    setSaving(true);
    try {
      let res: Response;
      if (mode === "edit" && selectedTemplateId && selectedVersion) {
        res = await fetch(
          `/api/templates/${encodeURIComponent(selectedTemplateId)}/versions/${selectedVersion}/patch`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadToSend),
          }
        );
      } else {
        res = await fetch(`/api/templates/${encodeURIComponent(resolvedTemplateId)}/versions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadToSend),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || data?.error || "No se pudo guardar");
      }

      setSuccess(mode === "edit" ? "Template actualizado" : "Nueva version creada");
      await loadLatestTemplates();
      const latestVersions = await loadVersions(resolvedTemplateId);
      if (latestVersions.length) {
        await loadTemplateVersion(resolvedTemplateId, latestVersions[0].version);
      }
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ThemeShell>
        <div className={styles.loading}>Cargando editor de templates...</div>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={me}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Templates Â· Edition</p>
            <h1>Templates de checklists</h1>
            <p className={styles.subtitle}>
              {isVisualMode
                ? "Editor visual para crear o modificar formularios."
                : isFileMode
                  ? "Importa un template desde un archivo JSON y luego ajustalo en el editor."
                  : "Pega un JSON de template y cargalo para seguir editando."}
              Acceso para{" "}
              {ROLE_OPTIONS_ES.filter((r) => ["admin"].includes(r.value))
                .map((r) => r.label)
                .join(" y ")}
              .
            </p>
          </div>
          <div className={styles.heroActions}>
            {isVisualMode ? (
              <>
                <button type="button" className={styles.secondaryBtn} onClick={loadLatestTemplates} disabled={busy}>
                  {busy ? "Cargando..." : "Actualizar templates"}
                </button>
                <button type="button" className={styles.primaryBtn} onClick={startNewTemplate}>
                  Nuevo template
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => router.push("/templates/edition")}
                >
                  Volver a metodos
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => router.push("/templates/editor?mode=visual")}
                >
                  Abrir editor visual
                </button>
              </>
            )}
          </div>
        </section>

        {(error || success) && (
          <section className={styles.messages}>
            {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
            {success ? <div className={`${styles.message} ${styles.success}`}>{success}</div> : null}
          </section>
        )}

        {isVisualMode ? (
          <section className={styles.layout}>
            <aside className={styles.sidebar}>
              <div className={styles.cardHeader}>
                <h2>Templates</h2>
                <span>{templates.length}</span>
              </div>

              <div className={styles.templateList}>
                {templates.length === 0 ? (
                  <div className={styles.emptySmall}>No hay templates cargados.</div>
                ) : (
                  templates.map((t) => {
                    const active = selectedTemplateId === t.templateId;
                    return (
                      <button
                        key={`${t.templateId}-${t.version}`}
                        type="button"
                        className={`${styles.templateItem} ${active ? styles.templateItemActive : ""}`}
                        onClick={() => handleSelectTemplate(t.templateId)}
                      >
                        <div className={styles.templateItemTop}>
                          <strong>{t.title || t.templateId}</strong>
                          <span className={styles.versionPill}>v{t.version}</span>
                        </div>
                        <small>{t.templateId}</small>
                      </button>
                    );
                  })
                )}
              </div>

              <div className={styles.versionsBox}>
                <div className={styles.cardHeader}>
                  <h3>Versiones</h3>
                  <span>{versions.length}</span>
                </div>
                {selectedTemplateId ? (
                  <div className={styles.versionList}>
                    {versions.map((v) => (
                      <button
                        key={`${v.templateId}-${v.version}`}
                        type="button"
                        className={`${styles.versionBtn} ${selectedVersion === v.version ? styles.versionBtnActive : ""}`}
                        onClick={() => handleSelectVersion(v.version)}
                      >
                        <span>v{v.version}</span>
                        <small>{v.isActive ? "Activa" : "Inactiva"}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptySmall}>Selecciona un template para ver versiones.</div>
                )}
              </div>
            </aside>

            {isEditorOpen ? (
              <section className={styles.editorPanel}>
              <div className={styles.cardHeader}>
                <h2>{mode === "edit" ? "Editar template" : "Crear template / version"}</h2>
                <div className={styles.editorActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={closeEditor}>
                    Cerrar editor
                  </button>
                  {mode === "edit" ? (
                    <button type="button" className={styles.secondaryBtn} onClick={cloneAsNewVersion}>
                      Guardar como nueva version
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={saveTemplate}
                    disabled={saving || !canEditTemplates}
                  >
                    {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear version"}
                  </button>
                </div>
              </div>

              <div className={styles.topGrid}>
                <label className={styles.field}>
                  <span>Titulo</span>
                  <input
                    value={editor.title}
                    onChange={(e) => updateEditor("title", e.target.value)}
                    placeholder="Checklist de transporte de carga"
                  />
                </label>
                <label className={styles.field}>
                  <span>Titulo corto (opcional)</span>
                  <input
                    value={String(editor.shortTitle || "")}
                    onChange={(e) => updateEditor("shortTitle", e.target.value)}
                    placeholder="Ej: Transporte de carga"
                  />
                </label>
                <label className={`${styles.field} ${styles.inlineCheck}`}>
                  <input
                    type="checkbox"
                    checked={editor.isActive}
                    onChange={(e) => updateEditor("isActive", e.target.checked)}
                  />
                  <span>Version activa</span>
                </label>
              </div>

              <div className={styles.sectionsHeader}>
                <h3>Secciones y campos</h3>
                <button type="button" className={styles.secondaryBtn} onClick={addSection}>
                  + Agregar seccion
                </button>
              </div>

              <div className={styles.sections}>
                {editor.sections.map((section, sectionIndex) => (
                  <article key={section.id || sectionIndex} className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitleWrap}>
                        <span className={styles.sectionIndex}>Seccion {sectionIndex + 1}</span>
                        <div className={styles.moveBtns}>
                          <button type="button" onClick={() => moveSection(sectionIndex, -1)}>â†‘</button>
                          <button type="button" onClick={() => moveSection(sectionIndex, 1)}>â†“</button>
                        </div>
                      </div>
                      <button type="button" className={styles.dangerBtn} onClick={() => removeSection(sectionIndex)}>
                        Eliminar seccion
                      </button>
                    </div>

                    <div className={styles.sectionFields}>
                      <label className={styles.field}>
                        <span>Titulo</span>
                        <input value={section.title} onChange={(e) => updateSection(sectionIndex, { title: e.target.value })} />
                      </label>
                      <label className={styles.field}>
                        <span>Descripcion</span>
                        <textarea
                          rows={2}
                          value={section.description || ""}
                          onChange={(e) => updateSection(sectionIndex, { description: e.target.value })}
                        />
                      </label>
                      <label className={`${styles.field} ${styles.inlineCheck}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(section.isMain)}
                          onChange={(e) => updateSection(sectionIndex, { isMain: e.target.checked })}
                        />
                        <span>Seccion principal (isMain)</span>
                      </label>
                    </div>

                    <div className={styles.fieldsToolbar}>
                      <strong>Campos ({section.fields.length})</strong>
                      <div className={styles.kindQuickAdd}>
                        <select
                          defaultValue={DEFAULT_FIELD_KIND}
                          onChange={(e) => {
                            addField(sectionIndex, e.target.value);
                            e.currentTarget.value = DEFAULT_FIELD_KIND;
                          }}
                        >
                          {FIELD_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              + {getFieldKindLabelEs(kind)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className={styles.fieldCards}>
                      {section.fields.map((field, fieldIndex) => (
                        <div key={field.id || fieldIndex} className={styles.fieldCard}>
                          <div className={styles.fieldCardHeader}>
                            <div className={styles.fieldChip}>{getFieldKindLabelEs(field.kind)}</div>
                            <div className={styles.moveBtns}>
                              <button type="button" onClick={() => moveField(sectionIndex, fieldIndex, -1)}>â†‘</button>
                              <button type="button" onClick={() => moveField(sectionIndex, fieldIndex, 1)}>â†“</button>
                            </div>
                            <button
                              type="button"
                              className={styles.dangerIconBtn}
                              onClick={() => removeField(sectionIndex, fieldIndex)}
                              aria-label="Eliminar campo"
                            >
                              x
                            </button>
                          </div>

                          <div className={styles.fieldGrid}>
                            <label className={styles.field}>
                              <span>Tipo (interno)</span>
                              <select
                                value={field.kind}
                                onChange={(e) => updateField(sectionIndex, fieldIndex, { kind: e.target.value })}
                              >
                                {FIELD_KINDS.map((kind) => (
                                  <option key={kind} value={kind}>
                                    {getFieldKindLabelEs(kind)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className={styles.field}>
                              <span>Etiqueta</span>
                              <input
                                value={field.label}
                                onChange={(e) => updateField(sectionIndex, fieldIndex, { label: e.target.value })}
                              />
                            </label>
                            <label className={`${styles.field} ${styles.inlineCheck}`}>
                              <input
                                type="checkbox"
                                checked={Boolean(field.required)}
                                onChange={(e) => updateField(sectionIndex, fieldIndex, { required: e.target.checked })}
                              />
                              <span>Obligatorio</span>
                            </label>

                            <label className={styles.field}>
                              <span>Placeholder</span>
                              <input
                                value={field.placeholder || ""}
                                onChange={(e) =>
                                  updateField(sectionIndex, fieldIndex, { placeholder: e.target.value })
                                }
                              />
                            </label>

                            <label className={styles.field}>
                              <span>Descripcion / Ayuda</span>
                              <input
                                value={field.description || ""}
                                onChange={(e) =>
                                  updateField(sectionIndex, fieldIndex, { description: e.target.value })
                                }
                              />
                            </label>

                            {field.kind === "triStatus" ? (
                              <label className={`${styles.field} ${styles.inlineCheck}`}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.requireObsWhenBad)}
                                  onChange={(e) =>
                                    updateField(sectionIndex, fieldIndex, {
                                      requireObsWhenBad: e.target.checked,
                                    })
                                  }
                                />
                                <span>Requerir observacion si esta mal</span>
                              </label>
                            ) : null}

                            {(field.kind === "select" || field.kind === "multiSelect" || field.kind === "radioGroup") ? (
                              <label className={`${styles.field} ${styles.fieldSpan2}`}>
                                <span>Opciones (una por linea: value|label)</span>
                                <textarea
                                  rows={4}
                                  value={optionsToText(field.options)}
                                  onChange={(e) =>
                                    updateField(sectionIndex, fieldIndex, {
                                      options: parseOptionsInput(e.target.value),
                                    })
                                  }
                                />
                              </label>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              </section>
            ) : (
              <section className={styles.emptyEditorPanel}>
              <div className={styles.emptyEditorCard}>
                <p className={styles.kicker}>Editor visual</p>
                <h2>Selecciona un template o crea uno nuevo</h2>
                <p className={styles.subtitle}>
                  Elegi un template de la lista para editar una version existente, o usa
                  <strong> Nuevo template</strong> para empezar desde cero.
                </p>
                <div className={styles.helpBox}>
                  <h3>Tipos soportados</h3>
                  <ul>
                    {FIELD_KINDS.map((k) => (
                      <li key={k}>
                        {getFieldKindLabelEs(k)}
                      </li>
                    ))}
                  </ul>
                  <p>
                    Usuario actual: <strong>{roleLabelEs(me?.role)}</strong> ({fullName(me)}).
                  </p>
                </div>
              </div>
              </section>
            )}
          </section>
        ) : (
          <section className={styles.importOnlyWrap}>
            <article className={styles.importOnlyCard}>
              {isFileMode ? (
                <div className={styles.importBoxNoDivider}>
                  <div className={styles.cardHeader}>
                    <h3>Importar por archivo</h3>
                  </div>
                  <p className={styles.importHint}>
                    Selecciona un archivo <code>.json</code>. Al importar, se abrira el editor visual con el contenido cargado.
                  </p>
                  <input
                    ref={jsonFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleJsonFileSelected}
                    hidden
                  />
                  <div className={styles.importActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => jsonFileInputRef.current?.click()}
                      disabled={!canEditTemplates || importing}
                    >
                      {importing ? "Importando..." : "Subir archivo JSON"}
                    </button>
                  </div>
                </div>
              ) : null}

              {isJsonMode ? (
                <div className={styles.importBoxNoDivider}>
                  <div className={styles.cardHeader}>
                    <h3>Importar JSON pegado</h3>
                  </div>
                  <p className={styles.importHint}>
                    Pega un JSON valido. Al importar, se abrira el editor visual con el contenido cargado.
                  </p>
                  <label className={styles.field}>
                    <span>Pegar JSON</span>
                    <textarea
                      className={styles.importTextarea}
                      rows={14}
                      value={jsonTextToImport}
                      onChange={(e) => setJsonTextToImport(e.target.value)}
                      placeholder='{"templateId":"checklist_carga","title":"Checklist de carga","sections":[...]}'
                    />
                  </label>
                  <div className={styles.importActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleImportFromTextarea}
                      disabled={!canEditTemplates || importing}
                    >
                      {importing ? "Importando..." : "Importar JSON pegado"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          </section>
        )}

        {importModalOpen ? (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Importacion completada">
            <div className={styles.modalCard}>
              <h3>Cargado correctamente</h3>
              <p>El template se importo y se guardo como nueva version.</p>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => {
                    setImportModalOpen(false);
                    router.push("/templates/edition");
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </ThemeShell>
  );
}


