"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import { ROLE_OPTIONS_ES, roleLabelEs } from "@/lib/roles";
import styles from "./page.module.css";

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
};

type FieldOption = { value: string; label: string };
type TemplateField = {
  id: string;
  kind: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  requireObsWhenBad?: boolean;
  options?: FieldOption[];
};
type TemplateSection = {
  id: string;
  title: string;
  description?: string;
  fields: TemplateField[];
};

type TemplateListItem = {
  _id?: string;
  templateId: string;
  version: number;
  title: string;
  isActive?: boolean;
  sections?: TemplateSection[];
  createdAt?: string;
  updatedAt?: string;
};

type EditorTemplate = {
  templateId: string;
  title: string;
  isActive: boolean;
  sections: TemplateSection[];
};

const FIELD_KINDS = [
  "text",
  "number",
  "date",
  "yesNo",
  "triStatus",
  "note",
  "select",
  "multiSelect",
  "signature",
] as const;

const DEFAULT_FIELD_KIND = "text";
const FIELD_KIND_LABELS_ES: Record<(typeof FIELD_KINDS)[number], string> = {
  text: "Texto",
  number: "Numero",
  date: "Fecha",
  yesNo: "Si / No",
  triStatus: "Estado (3 opciones)",
  note: "Nota",
  select: "Seleccion simple",
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
    ...(kind === "select" || kind === "multiSelect"
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
    templateId: "",
    title: "",
    isActive: true,
    sections: [createEmptySection()],
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
    let sectionId =
      mode === "edit" && String(section.id || "").trim()
        ? String(section.id)
        : `section_${sectionBase}`;

    let sectionSuffix = 2;
    while (usedSectionIds.has(sectionId)) {
      sectionId = `section_${sectionBase}_${sectionSuffix++}`;
    }
    usedSectionIds.add(sectionId);

    const usedFieldIds = new Set<string>();
    const fields = section.fields.map((field, fieldIndex) => {
      const fieldBase = slugifyTemplateId(field.label) || `campo_${fieldIndex + 1}`;
      let fieldId =
        mode === "edit" && String(field.id || "").trim()
          ? String(field.id)
          : fieldBase;

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

export default function TemplateEditorPage() {
  const router = useRouter();
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [versions, setVersions] = React.useState<TemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [selectedVersion, setSelectedVersion] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editor, setEditor] = React.useState<EditorTemplate>(createEmptyTemplate());

  const canEditTemplates = me?.role === "admin" || me?.role === "reviewer";

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
      templateId: item.templateId || templateId,
      title: item.title || "",
      isActive: item.isActive ?? true,
      sections:
        Array.isArray(item.sections) && item.sections.length
          ? deepClone(item.sections)
          : [createEmptySection()],
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
        if (!["admin", "reviewer"].includes(meJson.user.role)) {
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
        next.templateId = slugifyTemplateId(String(value));
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
      if (current.kind !== "select" && current.kind !== "multiSelect") delete current.options;
      if ((current.kind === "select" || current.kind === "multiSelect") && !current.options) {
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
      templateId: resolvedTemplateId,
      title: editor.title.trim(),
      isActive: editor.isActive,
      sections: buildGeneratedSections(editor.sections, mode),
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
            <p className={styles.kicker}>Editor visual</p>
            <h1>Templates de checklists</h1>
            <p className={styles.subtitle}>
              Editor para crear o modificar formularios sin escribir JSON a mano.
              Acceso para{" "}
              {ROLE_OPTIONS_ES.filter((r) => ["admin", "reviewer"].includes(r.value))
                .map((r) => r.label)
                .join(" y ")}
              .
            </p>
          </div>
          <div className={styles.heroActions}>
            <button type="button" className={styles.secondaryBtn} onClick={loadLatestTemplates} disabled={busy}>
              {busy ? "Cargando..." : "Actualizar templates"}
            </button>
            <button type="button" className={styles.primaryBtn} onClick={startNewTemplate}>
              Nuevo template
            </button>
          </div>
        </section>

        {(error || success) && (
          <section className={styles.messages}>
            {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
            {success ? <div className={`${styles.message} ${styles.success}`}>{success}</div> : null}
          </section>
        )}

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
                          <button type="button" onClick={() => moveSection(sectionIndex, -1)}>↑</button>
                          <button type="button" onClick={() => moveSection(sectionIndex, 1)}>↓</button>
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
                              <button type="button" onClick={() => moveField(sectionIndex, fieldIndex, -1)}>↑</button>
                              <button type="button" onClick={() => moveField(sectionIndex, fieldIndex, 1)}>↓</button>
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

                            {(field.kind === "select" || field.kind === "multiSelect") ? (
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
      </main>
    </ThemeShell>
  );
}
