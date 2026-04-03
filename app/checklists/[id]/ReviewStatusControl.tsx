"use client";

import * as React from "react";
import { uploadImageFileToCloudinary } from "@/lib/cloudinaryUpload";
import styles from "./ReviewStatusControl.module.css";

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export default function ReviewStatusControl({
  checklistId,
  initialStatus,
  initialNote,
  initialImageUrl,
  canEdit,
}: {
  checklistId: string;
  initialStatus: ApprovalStatus;
  initialNote?: string;
  initialImageUrl?: string;
  canEdit: boolean;
}) {
  const [status, setStatus] = React.useState<ApprovalStatus>(initialStatus);
  const [note, setNote] = React.useState(String(initialNote || ""));
  const [imageUrl, setImageUrl] = React.useState(String(initialImageUrl || ""));
  const [editingDecision, setEditingDecision] = React.useState(initialStatus === "PENDING");
  const [confirmChangeOpen, setConfirmChangeOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const hasFinalDecision = status === "APPROVED" || status === "REJECTED";

  async function updateStatus(next: ApprovalStatus) {
    if (!canEdit || loading || uploading || !checklistId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/checklists/${encodeURIComponent(checklistId)}/review-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          approvalStatus: next,
          approvalNote: note,
          approvalImageUrl: imageUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "No se pudo actualizar la aprobacion de viaje");
      }

      setStatus(next);
      setEditingDecision(next === "PENDING");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo actualizar";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function processImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImageFileToCloudinary(file, {
        folder: "checklist/approval",
        tag: "approval",
      });
      if (!uploaded.secureUrl) throw new Error("No se pudo obtener URL de imagen");
      setImageUrl(uploaded.secureUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo subir la imagen";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canEdit || loading || uploading) return;
    await processImageFile(file);
    e.target.value = "";
  }

  async function onDropImage(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!canEdit || loading || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processImageFile(file);
  }

  function onDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit || loading || uploading) return;
    setDragActive(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function onChangeDecision() {
    if (!canEdit || loading || uploading) return;
    setError(null);
    setConfirmChangeOpen(true);
  }

  function confirmChangeDecision() {
    setConfirmChangeOpen(false);
    setNote("");
    setImageUrl("");
    setEditingDecision(true);
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <h2>Se aprueba para viajar?</h2>
        <span
          className={`${styles.badge} ${
            status === "APPROVED" ? styles.approved : status === "REJECTED" ? styles.rejected : styles.pending
          }`}
        >
          {status === "APPROVED"
            ? "Aprobado para viajar"
            : status === "REJECTED"
              ? "No aprobado para viajar"
              : "Sin decision"}
        </span>
      </div>

      <p className={styles.help}>Decision operativa para habilitar o rechazar el viaje.</p>

      {canEdit ? (
        <div className={styles.formArea}>
          {!editingDecision && hasFinalDecision ? (
            <div className={styles.lockedArea}>
              <p className={styles.readOnly}>
                Ya existe una decision final. Si queres registrar una nueva, usa "Cambiar decision".
              </p>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnChange}`}
                onClick={onChangeDecision}
                disabled={loading || uploading}
              >
                Cambiar decision
              </button>
              {note ? (
                <div className={styles.field}>
                  <span>Ultima observacion</span>
                  <p className={styles.readOnly}>{note}</p>
                </div>
              ) : null}
              {imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className={styles.imagePreviewLink}>
                  <img src={imageUrl} alt="Evidencia de aprobacion" className={styles.imagePreview} />
                </a>
              ) : null}
            </div>
          ) : (
            <>
              <label className={styles.field}>
                <span>Observacion (opcional)</span>
                <textarea
                  className={styles.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Detalle adicional de la aprobacion o rechazo..."
                  rows={3}
                  maxLength={2000}
                  disabled={loading || uploading}
                />
              </label>

              <div className={styles.field}>
                <span>Evidencia de aprobacion (opcional)</span>
                <div className={styles.uploadRow}>
                  <label
                    className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""} ${
                      loading || uploading ? styles.dropzoneDisabled : ""
                    }`}
                    onDrop={onDropImage}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                  >
                    <input type="file" accept="image/*" onChange={onPickImage} disabled={loading || uploading} />
                    {uploading
                      ? "Subiendo imagen..."
                      : "Arrastrar imagen aqui o hacer click para seleccionar"}
                  </label>
                  {imageUrl ? (
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => setImageUrl("")}
                      disabled={loading || uploading}
                    >
                      Quitar imagen
                    </button>
                  ) : null}
                </div>
              </div>

              {imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className={styles.imagePreviewLink}>
                  <img src={imageUrl} alt="Evidencia de aprobacion" className={styles.imagePreview} />
                </a>
              ) : null}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnApprove} ${status === "APPROVED" ? styles.active : ""}`}
                  onClick={() => updateStatus("APPROVED")}
                  disabled={loading || uploading}
                >
                  {loading ? "Guardando..." : "Aprobar"}
                </button>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnReject} ${status === "REJECTED" ? styles.active : ""}`}
                  onClick={() => updateStatus("REJECTED")}
                  disabled={loading || uploading}
                >
                  {loading ? "Guardando..." : "No aprobar"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className={styles.formArea}>
          <p className={styles.readOnly}>Solo supervisor, manager o admin pueden aprobar un viaje.</p>
          {note ? (
            <div className={styles.field}>
              <span>Observacion</span>
              <p className={styles.readOnly}>{note}</p>
            </div>
          ) : null}
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noreferrer" className={styles.imagePreviewLink}>
              <img src={imageUrl} alt="Evidencia de aprobacion" className={styles.imagePreview} />
            </a>
          ) : null}
        </div>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      {confirmChangeOpen ? (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmModal}>
            <h3>Confirmar cambio</h3>
            <p>¿Está seguro que desea cambiar la decisión sobre este checklist?</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setConfirmChangeOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnChange}`}
                onClick={confirmChangeDecision}
              >
                Cambiar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

