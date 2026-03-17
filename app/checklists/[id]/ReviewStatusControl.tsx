"use client";

import * as React from "react";
import styles from "./ReviewStatusControl.module.css";

type ReviewStatus = "SIN_REVISION" | "REVISADO";

export default function ReviewStatusControl({
  checklistId,
  initialStatus,
  canEdit,
}: {
  checklistId: string;
  initialStatus: ReviewStatus;
  canEdit: boolean;
}) {
  const [status, setStatus] = React.useState<ReviewStatus>(initialStatus);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function updateStatus(next: ReviewStatus) {
    if (!canEdit || loading || !checklistId || next === status) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/checklists/${encodeURIComponent(checklistId)}/review-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reviewStatus: next }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "No se pudo actualizar el estado de revision");
      }

      setStatus(next);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo actualizar";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <h2>Revision</h2>
        <span className={`${styles.badge} ${status === "REVISADO" ? styles.reviewed : styles.unreviewed}`}>
          {status === "REVISADO" ? "Revisado" : "Sin revision"}
        </span>
      </div>

      <p className={styles.help}>
        Estado de revision administrativa del checklist.
      </p>

      {canEdit ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${status === "SIN_REVISION" ? styles.active : ""}`}
            onClick={() => updateStatus("SIN_REVISION")}
            disabled={loading}
          >
            Marcar sin revision
          </button>

          <button
            type="button"
            className={`${styles.btn} ${status === "REVISADO" ? styles.active : ""}`}
            onClick={() => updateStatus("REVISADO")}
            disabled={loading}
          >
            Marcar revisado
          </button>
        </div>
      ) : (
        <p className={styles.readOnly}>Solo admin y reviewer pueden cambiar este estado.</p>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
