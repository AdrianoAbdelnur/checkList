"use client";

import React from "react";

type AnyObj = Record<string, any>;

function Badge({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        background: "#111827",
        color: "white",
      }}
    >
      {text}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0" }}>
      <div style={{ width: 260, fontWeight: 800, color: "#111827" }}>
        {label}
      </div>
      <div style={{ flex: 1, color: "#111827" }}>{value}</div>
    </div>
  );
}

function PhotosStrip({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (url: string) => void;
}) {
  if (!urls || urls.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
      {urls.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onOpen(u)}
          style={{
            padding: 0,
            border: 0,
            background: "transparent",
            cursor: "pointer",
          }}
          aria-label="Abrir foto"
        >
          <img
            src={u}
            alt="Foto"
            style={{
              width: 160,
              height: 120,
              objectFit: "cover",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              display: "block",
            }}
          />
        </button>
      ))}
    </div>
  );
}

function PhotoModal({
  open,
  url,
  onClose,
}: {
  open: boolean;
  url: string | null;
  onClose: () => void;
}) {
  if (!open || !url) return null;

  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "90vh",
          background: "white",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 10,
            borderBottom: "1px solid #e5e7eb",
            gap: 10,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              color: "#111827",
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={url}
          >
            Vista previa
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #e5e7eb",
              background: "white",
              borderRadius: 10,
              padding: "8px 10px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>

        <div
          style={{
            padding: 12,
            background: "#0b1220",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          {isVideo ? (
            <video
              src={url}
              controls
              style={{
                maxWidth: "100%",
                maxHeight: "78vh",
                borderRadius: 12,
                background: "#000",
              }}
            />
          ) : (
            <img
              src={url}
              alt="Vista previa"
              style={{
                maxWidth: "100%",
                maxHeight: "78vh",
                objectFit: "contain",
                borderRadius: 12,
                background: "#fff",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function renderValue(field: AnyObj, v: AnyObj | undefined) {
  if (!v) return <span style={{ opacity: 0.6 }}>—</span>;

  switch (v.kind) {
    case "triStatus":
      return (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge text={String(v.status ?? "—")} />
          {v.obs?.trim() ? (
            <span style={{ opacity: 0.9 }}>Obs: {v.obs}</span>
          ) : null}
        </div>
      );

    case "yesNo":
      return <Badge text={v.value ? "SÍ" : "NO"} />;

    case "text":
    case "note":
      return (
        <div style={{ whiteSpace: "pre-wrap" }}>
          {String(v.value ?? "").trim() || "—"}
        </div>
      );

    case "number":
      return <span>{v.value ?? "—"}</span>;

    case "date":
      return <span>{v.value ?? "—"}</span>;

    case "select": {
      const opt = field?.options?.find((o: any) => o.value === v.value);
      return <Badge text={opt?.label ?? String(v.value ?? "—")} />;
    }

    case "multiSelect": {
      const values: string[] = Array.isArray(v.value) ? v.value : [];
      if (values.length === 0) return <span style={{ opacity: 0.6 }}>—</span>;
      const labels = values.map((val) => {
        const opt = field?.options?.find((o: any) => o.value === val);
        return opt?.label ?? val;
      });
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {labels.map((t) => (
            <Badge key={t} text={t} />
          ))}
        </div>
      );
    }

    case "signature":
      return v.dataUrl ? (
        <img
          src={v.dataUrl}
          alt="Firma"
          style={{
            width: "100%",
            maxWidth: 520,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "white",
          }}
        />
      ) : (
        <span style={{ opacity: 0.6 }}>Sin firma</span>
      );

    default:
      return <pre style={{ margin: 0 }}>{JSON.stringify(v, null, 2)}</pre>;
  }
}

export default function ChecklistViewer({
  template,
  checklist,
}: {
  template: AnyObj;
  checklist: AnyObj;
}) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalUrl, setModalUrl] = React.useState<string | null>(null);

  const openModal = (url: string) => {
    setModalUrl(url);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalUrl(null);
  };

  React.useEffect(() => {
    if (!modalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const values: AnyObj = checklist?.data?.values ?? {};
  const photosByFieldId: Record<string, string[]> =
    checklist?.data?.photosByFieldId ?? {};

  const sections: AnyObj[] =
    template?.sections ?? template?.data?.sections ?? template?.items ?? [];

  const allFieldIds = new Set<string>();
  sections.forEach((s) => {
    const fields: AnyObj[] = s?.fields ?? [];
    fields.forEach((f) => {
      if (f?.id) allFieldIds.add(String(f.id));
    });
  });

  const orphanPhotoKeys = Object.keys(photosByFieldId).filter(
    (k) => !allFieldIds.has(k)
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <PhotoModal open={modalOpen} url={modalUrl} onClose={closeModal} />

      <Card title="Resumen">
        <Row label="ID Checklist" value={String(checklist._id ?? "—")} />
        <Row label="Template" value={String(checklist.templateId ?? "—")} />
        <Row
          label="Versión"
          value={<Badge text={String(checklist.templateVersion ?? "—")} />}
        />
        <Row
          label="Estado"
          value={<Badge text={String(checklist.status ?? "—")} />}
        />
      </Card>

      {sections.map((section) => {
        const sectionTitle =
          section?.title ??
          section?.label ??
          section?.name ??
          section?.id ??
          "Sección";

        const fields: AnyObj[] = section?.fields ?? [];

        return (
          <Card key={String(section.id ?? sectionTitle)} title={sectionTitle}>
            {fields.map((field) => {
              const fieldId = String(field.id);
              const fieldLabel = field.label ?? fieldId;

              const v = values?.[fieldId];
              const photos = photosByFieldId?.[fieldId] ?? [];

              return (
                <div
                  key={fieldId}
                  style={{
                    borderTop: "1px solid #f3f4f6",
                    paddingTop: 6,
                    paddingBottom: 8,
                  }}
                >
                  <Row label={fieldLabel} value={renderValue(field, v)} />
                  <PhotosStrip urls={photos} onOpen={openModal} />
                </div>
              );
            })}
          </Card>
        );
      })}

      {orphanPhotoKeys.length > 0 ? (
        <Card title="Fotos (sin campo en template)">
          {orphanPhotoKeys.map((k) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>{k}</div>
              <PhotosStrip urls={photosByFieldId[k] ?? []} onOpen={openModal} />
            </div>
          ))}
        </Card>
      ) : null}

      {sections.length === 0 ? (
        <Card title="Template sin secciones">
          <pre style={{ margin: 0 }}>{JSON.stringify(template, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}
