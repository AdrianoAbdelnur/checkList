"use client";

import React from "react";

type AnyObj = Record<string, unknown>;

type OpenMediaFn = (url: string) => void;

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

function trimText(value: unknown) {
  return String(value ?? "").trim();
}

function asObj(value: unknown): AnyObj | null {
  return value && typeof value === "object" ? (value as AnyObj) : null;
}

function objectFitFromResizeMode(resizeMode: unknown): React.CSSProperties["objectFit"] {
  const mode = trimText(resizeMode).toLowerCase();
  if (mode === "contain") return "contain";
  if (mode === "stretch") return "fill";
  if (mode === "center") return "contain";
  return "cover";
}

function formatCreatedAt(value: unknown) {
  const text = trimText(value);
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeToneColor(tone: unknown) {
  const t = trimText(tone).toLowerCase();
  if (!t) return "var(--cv-badge-bg)";
  if (t === "success") return "rgba(22, 163, 74, 0.55)";
  if (t === "warning") return "rgba(245, 158, 11, 0.55)";
  if (t === "danger") return "rgba(239, 68, 68, 0.55)";
  if (t === "muted") return "rgba(100, 116, 139, 0.55)";
  if (t === "neutral") return "rgba(71, 85, 105, 0.55)";
  if (t.startsWith("#") || t.startsWith("rgb")) return tone as string;
  return "var(--cv-badge-bg)";
}

function getSemanticStatusTone(value: unknown): "success" | "warning" | "danger" | "neutral" {
  const text = trimText(value).toLowerCase();
  if (!text) return "neutral";

  if (
    text.includes("bueno") ||
    text.includes("ok") ||
    text.includes("aprob") ||
    text.includes("acept") ||
    text === "si" ||
    text === "sÃ­" ||
    text === "yes" ||
    text.includes("low") ||
    text.includes("bajo")
  ) {
    return "success";
  }

  if (
    text.includes("malo") ||
    text.includes("rechaz") ||
    text === "no" ||
    text.includes("high") ||
    text.includes("alto")
  ) {
    return "danger";
  }

  if (
    text.includes("na") ||
    text.includes("n/a") ||
    text.includes("moder") ||
    text.includes("medio") ||
    text.includes("warn")
  ) {
    return "warning";
  }

  return "neutral";
}

function statusBadgeColors(value: unknown) {
  const tone = getSemanticStatusTone(value);
  if (tone === "success") return { bg: "rgba(22, 163, 74, 0.55)", color: "#ffffff" };
  if (tone === "warning") return { bg: "rgba(245, 158, 11, 0.55)", color: "#111827" };
  if (tone === "danger") return { bg: "rgba(239, 68, 68, 0.55)", color: "#ffffff" };
  return { bg: "var(--cv-badge-bg)", color: "var(--cv-badge-text)" };
}

function getSelectLabel(field: AnyObj, value: unknown) {
  const v = trimText(value);
  if (!v) return "-";
  const options: AnyObj[] = Array.isArray(field?.options) ? field.options : [];
  const opt = options.find((o) => trimText(o?.value) === v);
  return trimText(opt?.label) || v;
}

function Badge({ text, bg, color }: { text: string; bg?: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        background: bg ?? "var(--cv-badge-bg)",
        color: color ?? "var(--cv-badge-text)",
        border: "1px solid var(--cv-border)",
      }}
    >
      {text}
    </span>
  );
}

function StatusBadge({ text, bg, color }: { text: string; bg?: string; color?: string }) {
  const colors = statusBadgeColors(text);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 78,
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        background: bg ?? colors.bg,
        color: color ?? colors.color,
        border: "1px solid var(--cv-border)",
        textAlign: "center",
        width: "fit-content",
        justifySelf: "start",
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
        border: "1px solid var(--cv-border)",
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        background: "var(--cv-card)",
        color: "var(--cv-text)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, description }: { label: string; value: React.ReactNode; description?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ width: "min(260px, 36vw)", minWidth: 180, fontWeight: 800, color: "var(--cv-text)" }}>{label}</div>
      <div style={{ flex: 1, minWidth: 240, color: "var(--cv-text)", display: "grid", gap: 6 }}>
        {value}
        {description ? <div style={{ color: "var(--cv-text-muted)", fontSize: 12 }}>{description}</div> : null}
      </div>
    </div>
  );
}

function MediaThumb({ url, onOpen, width = 160, height = 120 }: { url: string; onOpen: OpenMediaFn; width?: number; height?: number }) {
  const isVideo = isVideoUrl(url);

  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
      aria-label="Open media"
    >
      {isVideo ? (
        <video
          src={url}
          muted
          playsInline
          style={{
            width,
            height,
            objectFit: "cover",
            borderRadius: 12,
            border: "1px solid var(--cv-border)",
            background: "var(--cv-thumb-bg)",
            display: "block",
          }}
        />
      ) : (
        <img
          src={url}
          alt="Media"
          style={{
            width,
            height,
            objectFit: "cover",
            borderRadius: 12,
            border: "1px solid var(--cv-border)",
            background: "var(--cv-thumb-bg)",
            display: "block",
          }}
        />
      )}
    </button>
  );
}

function PhotosStrip({ urls, onOpen }: { urls: string[]; onOpen: OpenMediaFn }) {
  if (!urls || urls.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
      {urls.map((u, idx) => (
        <MediaThumb key={`${u}-${idx}`} url={u} onOpen={onOpen} />
      ))}
    </div>
  );
}

function PhotoModal({ open, url, onClose }: { open: boolean; url: string | null; onClose: () => void }) {
  if (!open || !url) return null;

  const isVideo = isVideoUrl(url);

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
          background: "var(--cv-modal-panel)",
          borderRadius: 16,
          border: "1px solid var(--cv-border)",
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
            borderBottom: "1px solid var(--cv-border)",
            gap: 10,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              color: "var(--cv-text)",
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={url}
          >
            Preview
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--cv-border)",
              background: "var(--cv-modal-header)",
              borderRadius: 10,
              padding: "8px 10px",
              fontWeight: 900,
              color: "var(--cv-text)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            padding: 12,
            background: "var(--cv-media-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          {isVideo ? (
            <video src={url} controls style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 12, background: "#000" }} />
          ) : (
            <img
              src={url}
              alt="Preview"
              style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain", borderRadius: 12, background: "var(--cv-thumb-bg)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function resolveZoneColor(maxSeverityIndex: number) {
  if (maxSeverityIndex <= 0) return "#2563eb";
  if (maxSeverityIndex === 1) return "#f59e0b";
  return "#ef4444";
}

function DamageMapValue({ field, value, onOpen }: { field: AnyObj; value: AnyObj | undefined; onOpen: OpenMediaFn }) {
  const [selectedZoneId, setSelectedZoneId] = React.useState<string | null>(null);

  const damages: AnyObj[] = value?.kind === "damageMap" && Array.isArray(value?.value) ? value.value : [];
  const zones: AnyObj[] = Array.isArray(field?.zones) ? field.zones : [];
  const imageUrl = trimText(field?.imageUrl);

  const zoneDamageMap = React.useMemo(() => {
    const map = new Map<string, AnyObj[]>();
    for (const damage of damages) {
      const zoneId = trimText(damage?.zoneId);
      if (!zoneId) continue;
      const current = map.get(zoneId) ?? [];
      map.set(zoneId, [...current, damage]);
    }
    return map;
  }, [damages]);

  const severityOptions: AnyObj[] = Array.isArray(field?.severityOptions) ? field.severityOptions : [];

  const getSeverityIndex = (severity: unknown) => {
    const current = trimText(severity);
    if (!current) return -1;
    return severityOptions.findIndex((opt) => trimText(opt?.value) === current);
  };

  const listToShow = React.useMemo(() => {
    if (!selectedZoneId) return damages;
    return zoneDamageMap.get(selectedZoneId) ?? [];
  }, [damages, selectedZoneId, zoneDamageMap]);

  const selectedZoneLabel = React.useMemo(() => {
    if (!selectedZoneId) return "Todas las zonas";
    const zone = zones.find((z) => trimText(z?.id) === selectedZoneId);
    return trimText(zone?.label) || selectedZoneId;
  }, [selectedZoneId, zones]);

  const aspectRatio = typeof field?.aspectRatio === "number" && field.aspectRatio > 0 ? field.aspectRatio : 16 / 9;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {imageUrl ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid var(--cv-border)",
            background: "var(--cv-thumb-bg)",
          }}
        >
          <img src={imageUrl} alt={trimText(field?.label) || "Damage map"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />

          {zones.map((zone) => {
            const zoneId = trimText(zone?.id);
            const zoneDamages = zoneDamageMap.get(zoneId) ?? [];
            const maxSeverityIndex = zoneDamages.reduce((acc, current) => Math.max(acc, getSeverityIndex(current?.severity)), -1);
            const hasDamage = zoneDamages.length > 0;
            const color = resolveZoneColor(maxSeverityIndex);
            const isActive = selectedZoneId === zoneId;

            return (
              <button
                key={zoneId}
                type="button"
                onClick={() => setSelectedZoneId((prev) => (prev === zoneId ? null : zoneId))}
                title={trimText(zone?.label) || zoneId}
                style={{
                  position: "absolute",
                  left: `${(Number(zone?.x) || 0) * 100}%`,
                  top: `${(Number(zone?.y) || 0) * 100}%`,
                  width: `${(Number(zone?.width) || 0) * 100}%`,
                  height: `${(Number(zone?.height) || 0) * 100}%`,
                  borderRadius: 8,
                  border: hasDamage ? `2px solid ${color}` : "1px solid rgba(148,163,184,0.5)",
                  background: hasDamage ? `${color}44` : "rgba(15,23,42,0.06)",
                  boxShadow: isActive ? "0 0 0 2px #ffffff" : "none",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--cv-border)",
            borderRadius: 14,
            background: "var(--cv-thumb-bg)",
            padding: 12,
            color: "var(--cv-text-muted)",
            fontWeight: 700,
          }}
        >
          El mapa de danos no tiene imagen configurada
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge text={`Danos: ${damages.length}`} />
        <Badge text="Bajo" bg="#1d4ed822" color="#1d4ed8" />
        <Badge text="Medio" bg="#f59e0b22" color="#b45309" />
        <Badge text="Alto" bg="#ef444422" color="#b91c1c" />
      </div>

      <div style={{ fontSize: 12, color: "var(--cv-text-muted)", fontWeight: 800 }}>Mostrando: {selectedZoneLabel}</div>

      {listToShow.length === 0 ? (
        <div style={{ color: "var(--cv-text-muted)", fontWeight: 700 }}>No hay danos cargados.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {listToShow.map((damage) => {
            const severity = trimText(damage?.severityLabel || damage?.severity || "-");
            const zoneLabel = trimText(damage?.zoneLabel || damage?.zoneId || "Zona");
            const typeLabel = trimText(damage?.damageTypeLabel || damage?.damageType || "Dano");
            const createdAt = formatCreatedAt(damage?.createdAt);
            const photos: string[] = Array.isArray(damage?.photos) ? damage.photos : [];

            return (
              <div key={trimText(damage?.id) || `${zoneLabel}-${typeLabel}-${createdAt}`} style={{ border: "1px solid var(--cv-border)", borderRadius: 12, padding: 10, background: "color-mix(in oklab, var(--cv-card) 88%, transparent)" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Badge text={zoneLabel} />
                  <Badge text={typeLabel} />
                  <Badge text={severity} bg={normalizeToneColor(severity.toLowerCase().includes("high") ? "danger" : severity.toLowerCase().includes("med") ? "warning" : "success")} color="#fff" />
                </div>

                {trimText(damage?.comment) ? <div style={{ marginTop: 8 }}>{trimText(damage?.comment)}</div> : null}
                {createdAt ? <div style={{ marginTop: 6, fontSize: 12, color: "var(--cv-text-muted)" }}>{createdAt}</div> : null}
                <PhotosStrip urls={photos} onOpen={onOpen} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderValue(field: AnyObj, v: AnyObj | undefined, onOpen: OpenMediaFn) {
  const kind = trimText(field?.kind);

  if (kind === "image") {
    const imageUrl = trimText(field?.imageUrl);
    const caption = trimText(field?.caption);
    const width = typeof field?.width === "number" ? field.width : "100%";
    const height = typeof field?.height === "number" ? field.height : undefined;
    const aspectRatio = typeof field?.aspectRatio === "number" ? field.aspectRatio : height ? undefined : 16 / 9;
    const borderRadius = typeof field?.borderRadius === "number" ? field.borderRadius : 14;

    if (!imageUrl) {
      return <span style={{ opacity: 0.7, color: "var(--cv-text-muted)" }}>URL de imagen no configurada</span>;
    }

    return (
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" onClick={() => onOpen(imageUrl)} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", width: "fit-content", maxWidth: "100%" }}>
          <img
            src={imageUrl}
            alt={trimText(field?.label) || "Image field"}
            style={{
              width,
              maxWidth: "100%",
              height,
              aspectRatio,
              objectFit: objectFitFromResizeMode(field?.resizeMode),
              borderRadius,
              border: "1px solid var(--cv-border)",
              background: "var(--cv-thumb-bg)",
              display: "block",
            }}
          />
        </button>
        {caption ? <span style={{ color: "var(--cv-text-muted)", fontSize: 12 }}>{caption}</span> : null}
      </div>
    );
  }

  if (kind === "imageGrid") {
    const images: AnyObj[] = Array.isArray(field?.images) ? field.images : [];
    const valid = images.map((item, idx) => ({ url: trimText(item?.imageUrl), caption: trimText(item?.caption), idx })).filter((x) => x.url);

    if (valid.length === 0) {
      return <span style={{ opacity: 0.7, color: "var(--cv-text-muted)" }}>Grilla de imagenes no configurada</span>;
    }

    const columns = typeof field?.columns === "number" && field.columns > 0 ? Math.floor(field.columns) : 2;
    const gap = typeof field?.gap === "number" ? field.gap : 8;
    const borderRadius = typeof field?.borderRadius === "number" ? field.borderRadius : 12;
    const aspectRatio = typeof field?.aspectRatio === "number" ? field.aspectRatio : 1;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {valid.map((img) => (
          <button key={`${img.url}-${img.idx}`} type="button" onClick={() => onOpen(img.url)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}>
            <img
              src={img.url}
              alt={img.caption || `Grid image ${img.idx + 1}`}
              style={{
                width: "100%",
                aspectRatio,
                objectFit: objectFitFromResizeMode(field?.resizeMode),
                borderRadius,
                border: "1px solid var(--cv-border)",
                background: "var(--cv-thumb-bg)",
                display: "block",
              }}
            />
            {img.caption ? <span style={{ marginTop: 4, display: "block", fontSize: 11, color: "var(--cv-text-muted)" }}>{img.caption}</span> : null}
          </button>
        ))}
      </div>
    );
  }

  if (kind === "cover") {
    const imageUrl = trimText(field?.imageUrl);
    const title = trimText(field?.title || field?.label || "Portada");
    const subtitle = trimText(field?.subtitle);
    const buttonText = trimText(field?.buttonText || "Continue");
    const acknowledged = v?.kind === "cover" ? Boolean(v?.acknowledged) : false;

    return (
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge text={acknowledged ? "Completada" : "Pendiente"} bg={acknowledged ? "#16a34a22" : "#f59e0b22"} color={acknowledged ? "#166534" : "#92400e"} />
          <Badge text={buttonText} />
        </div>

        {imageUrl ? (
          <button type="button" onClick={() => onOpen(imageUrl)} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" }}>
            <img
              src={imageUrl}
              alt={title}
              style={{ width: "100%", maxWidth: 560, aspectRatio: 16 / 9, objectFit: objectFitFromResizeMode(field?.resizeMode), borderRadius: 14, border: "1px solid var(--cv-border)", background: "var(--cv-thumb-bg)", display: "block" }}
            />
          </button>
        ) : (
          <span style={{ opacity: 0.7, color: "var(--cv-text-muted)" }}>La portada no tiene imagen configurada</span>
        )}

        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          {subtitle ? <div style={{ color: "var(--cv-text-muted)", marginTop: 2 }}>{subtitle}</div> : null}
        </div>
      </div>
    );
  }

  if (kind === "damageMap") {
    return <DamageMapValue field={field} value={v} onOpen={onOpen} />;
  }

  if (!v) return <span style={{ opacity: 0.6 }}>-</span>;

  switch (v.kind) {
    case "triStatus": {
      const status = trimText(v.status);
      const options: AnyObj[] = Array.isArray(field?.options) ? field.options : [];
      const current = options.find((opt) => trimText(opt?.value) === status);
      const statusLabel = trimText(current?.label) || status || "-";
      const tone = current?.tone ? normalizeToneColor(current?.tone) : statusBadgeColors(statusLabel).bg;
      const toneText = current?.tone ? "#fff" : statusBadgeColors(statusLabel).color;
      const comments: string[] = Array.isArray(current?.comments) ? current.comments.map((x: unknown) => trimText(x)).filter(Boolean) : [];

      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge text={statusLabel} bg={tone} color={toneText} />
            {trimText(v.obs) ? <span style={{ opacity: 0.9, color: "var(--cv-text-muted)" }}>Obs: {trimText(v.obs)}</span> : null}
          </div>
          {comments.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {comments.map((line, idx) => (
                <Badge key={`${line}-${idx}`} text={line} />
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    case "yesNo":
      if (v.value === null || v.value === undefined) return <span style={{ opacity: 0.6 }}>-</span>;
      return <StatusBadge text={v.value ? "SI" : "NO"} />;

    case "text":
      return <div style={{ whiteSpace: "pre-wrap" }}>{trimText(v.value) || "-"}</div>;

    case "note": {
      const content = trimText(v.value);
      const read = typeof v.read === "boolean" ? v.read : null;
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{content || "-"}</div>
          {read !== null ? (
            <Badge text={read ? "Leida" : "No leida"} bg={read ? "#16a34a22" : "#f59e0b22"} color={read ? "#166534" : "#92400e"} />
          ) : null}
        </div>
      );
    }

    case "number":
      return (
        <span>
          {typeof v.value === "number" ? v.value : trimText(v.value) || "-"}
        </span>
      );

    case "date":
      return <span>{trimText(v.value) || "-"}</span>;

    case "time":
      return <span>{trimText(v.value) || "-"}</span>;

    case "select": {
      const label = getSelectLabel(field, v.value);
      return <Badge text={label} />;
    }

    case "multiSelect": {
      const values: string[] = Array.isArray(v.value) ? v.value.map((x: unknown) => trimText(x)).filter(Boolean) : [];
      if (values.length === 0) return <span style={{ opacity: 0.6 }}>-</span>;
      const labels = values.map((val) => getSelectLabel(field, val));
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {labels.map((t, idx) => (
            <Badge key={`${t}-${idx}`} text={t} />
          ))}
        </div>
      );
    }

    case "signature": {
      const signatureUrl = trimText(v.dataUrl);
      return signatureUrl ? (
        <button type="button" onClick={() => onOpen(signatureUrl)} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }}>
          <img
            src={signatureUrl}
            alt="Signature"
            style={{ width: "100%", maxWidth: 520, border: "1px solid var(--cv-border)", borderRadius: 14, background: "var(--cv-thumb-bg)", display: "block" }}
          />
        </button>
      ) : (
        <span style={{ opacity: 0.6 }}>Sin firma</span>
      );
    }

    case "cover":
      return <Badge text={v.acknowledged ? "Completada" : "Pendiente"} />;

    default:
      return <pre style={{ margin: 0, color: "var(--cv-text)" }}>{JSON.stringify(v, null, 2)}</pre>;
  }
}

export default function ChecklistViewer({ template, checklist }: { template: AnyObj; checklist: AnyObj }) {
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

  const checklistData = asObj(checklist?.data) ?? {};
  const values = asObj(checklistData.values) ?? {};
  const photosByFieldId = (asObj(checklistData.photosByFieldId) ?? {}) as Record<string, string[]>;

  const templateData = asObj(template?.data);
  const sections = (
    (Array.isArray(template?.sections) ? template.sections : null) ??
    (templateData && Array.isArray(templateData.sections) ? templateData.sections : null) ??
    (Array.isArray(template?.items) ? template.items : null) ??
    []
  ) as AnyObj[];

  const allFieldIds = new Set<string>();
  sections.forEach((s) => {
    const fields: AnyObj[] = Array.isArray(s?.fields) ? (s.fields as AnyObj[]) : [];
    fields.forEach((f) => {
      if (f?.id) allFieldIds.add(String(f.id));
    });
  });

  const orphanPhotoKeys = Object.keys(photosByFieldId).filter((k) => !allFieldIds.has(k));

  return (
    <div style={{ display: "grid", gap: 14, color: "var(--cv-text)" }}>
      <PhotoModal open={modalOpen} url={modalUrl} onClose={closeModal} />

      <Card title="Resumen">
        <Row label="ID Checklist" value={String(checklist._id ?? "-")} />
        <Row label="Template" value={String(checklist.templateId ?? "-")} />
        <Row label="Version" value={<Badge text={String(checklist.templateVersion ?? "-")} />} />
        <Row label="Estado" value={<Badge text={String(checklist.status ?? "-")} />} />
      </Card>

      {sections.map((section) => {
        const sectionTitle = String(section?.title ?? section?.label ?? section?.name ?? section?.id ?? "Seccion");

        const fields: AnyObj[] = Array.isArray(section?.fields) ? (section.fields as AnyObj[]) : [];

        return (
          <Card key={String(section.id ?? sectionTitle)} title={sectionTitle}>
            {fields.map((field) => {
              const fieldId = String(field.id);
              const fieldKind = trimText(field?.kind);
              const hideLabel = fieldKind === "image" && field?.hideLabel === true;
              const fieldLabel = hideLabel ? "Visual" : String(field.label ?? fieldId);

              const v = asObj(values?.[fieldId]) ?? undefined;
              const photos = photosByFieldId?.[fieldId] ?? [];

              return (
                <div key={fieldId} style={{ borderTop: "1px solid var(--cv-border)", paddingTop: 6, paddingBottom: 8 }}>
                  <Row label={fieldLabel} value={renderValue(field, v, openModal)} description={trimText(field?.description) || undefined} />
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
          <pre style={{ margin: 0, color: "var(--cv-text)" }}>{JSON.stringify(template, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}

