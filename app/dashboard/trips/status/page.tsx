"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import { hasAnyRole, hasPermission } from "@/lib/roles";
import styles from "./page.module.css";

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  roles?: string[];
};

type TripStatusItem = {
  tripId: string;
  dominio: string;
  tipo: string;
  tripDateKey: string;
  expectedCount: number;
  completedCount: number;
  approvedCount: number;
  pendingApprovalCount: number;
  observedCount: number;
  pendingCount: number;
  status: "RED" | "YELLOW" | "GREEN" | "NONE";
  checks: Array<{
    templateId: string;
    templateTitle?: string;
    state: "PENDING" | "OBSERVED" | "OK";
    badCount: number;
    checklistId?: string;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  }>;
};

function formatTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateEsFromKey(key: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!m) return key || "-";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function statusLabel(status: TripStatusItem["status"]) {
  if (status === "RED") return "Rojo";
  if (status === "YELLOW") return "Amarillo";
  if (status === "GREEN") return "Verde";
  return "Sin checks";
}

function statusIcon(status: TripStatusItem["status"]) {
  if (status === "RED") return "X";
  if (status === "YELLOW") return "!";
  if (status === "GREEN") return "✓";
  return "•";
}

function templateLabel(templateId: string) {
  const raw = String(templateId || "").trim();
  if (!raw) return "Checklist";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function approvalDotClass(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return styles.dotApproved;
  if (status === "REJECTED") return styles.dotRejected;
  return styles.dotPending;
}

export default function TripsStatusPage() {
  const router = useRouter();
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dateKey, setDateKey] = React.useState(formatTodayKey());
  const [items, setItems] = React.useState<TripStatusItem[]>([]);
  const [summary, setSummary] = React.useState({
    totalTrips: 0,
    red: 0,
    yellow: 0,
    green: 0,
    none: 0,
  });

  const totals = React.useMemo(() => {
    const expected = items.reduce((acc, item) => acc + (item.expectedCount || 0), 0);
    const completed = items.reduce((acc, item) => acc + (item.completedCount || 0), 0);
    const approved = items.reduce((acc, item) => acc + (item.approvedCount || 0), 0);
    const pending = Math.max(expected - approved, 0);
    return { expected, completed, approved, pending };
  }, [items]);

  const load = React.useCallback(async (date: string) => {
    setError(null);
    const res = await fetch(`/api/trips/status?date=${encodeURIComponent(date)}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.message || "No se pudo cargar estado de viajes");
    setItems(Array.isArray(data.items) ? data.items : []);
    setSummary(data.summary || { totalTrips: 0, red: 0, yellow: 0, green: 0, none: 0 });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.user) {
          router.push("/login");
          return;
        }

        const allowed =
          hasPermission(data.user as Record<string, unknown>, "checklist.view_all") ||
          hasAnyRole(data.user as Record<string, unknown>, ["admin", "manager", "supervisor"]);
        if (!allowed) {
          router.push("/dashboard");
          return;
        }

        if (cancelled) return;
        setMe(data.user);
        await load(dateKey);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Error al cargar";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [dateKey, load, router]);

  if (loading) {
    return (
      <ThemeShell user={me}>
        <main className={styles.page}>
          <div className={styles.loading}>Cargando estado de viajes...</div>
        </main>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={me}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Control operativo</p>
            <h1>Estado de viajes</h1>
            <p className={styles.subtitle}>Semáforo por viaje según cumplimiento de checklists activos.</p>
          </div>
          <div className={styles.actions}>
            <label className={styles.dateWrap}>
              <span>Fecha</span>
              <div className={styles.dateSelector}>
                <input
                  type="text"
                  className={styles.dateDisplay}
                  value={formatDateEsFromKey(dateKey)}
                  readOnly
                  aria-label="Fecha seleccionada en formato español"
                />
                <svg
                  aria-hidden
                  className={styles.dateIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="2" />
                </svg>
                <input
                  type="date"
                  className={styles.datePickerNative}
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  lang="es-AR"
                  aria-label="Selector de fecha"
                />
              </div>
            </label>
            <a href="/dashboard/trips" className={styles.secondaryBtn}>Volver</a>
          </div>
        </section>

        {error ? <div className={styles.error}>{error}</div> : null}

        <section className={styles.summary}>
          <article><span>Total viajes</span><strong>{summary.totalTrips}</strong></article>
          <article><span>Rojo</span><strong className={styles.red}>{summary.red}</strong></article>
          <article><span>Amarillo</span><strong className={styles.yellow}>{summary.yellow}</strong></article>
          <article><span>Verde</span><strong className={styles.green}>{summary.green}</strong></article>
        </section>
        <section className={styles.miniSummary} aria-label="Resumen de checks">
          <article className={styles.miniCard}>
            <span>Esperados</span>
            <strong>{totals.expected}</strong>
          </article>
          <article className={styles.miniCard}>
            <span>Realizados</span>
            <strong>{totals.completed}</strong>
          </article>
          <article className={styles.miniCard}>
            <span>Aprobados</span>
            <strong>{totals.approved}</strong>
          </article>
          <article className={styles.miniCard}>
            <span>Pendientes</span>
            <strong>{totals.pending}</strong>
          </article>
        </section>

        <section className={styles.list}>
          {items.length === 0 ? (
            <div className={styles.empty}>No hay viajes para la fecha seleccionada.</div>
          ) : (
            items.map((item) => (
              <article key={item.tripId} className={styles.row}>
                <div className={styles.rowHead}>
                  <div className={styles.tripInfo}>
                    <h3>{item.dominio || "-"}</h3>
                    <p>{item.tipo || "Viaje"}</p>
                    <p className={styles.meta}>
                      Requeridos: {item.expectedCount} · Realizados: {item.completedCount} · Pend. aprobacion: {item.pendingApprovalCount}
                    </p>
                  </div>

                  <div className={styles.checkLinksCol}>
                    <span className={styles.checkLinksLabel}>Checks realizados</span>
                    <div className={styles.checkLinksWrap}>
                      {item.checks.filter((c) => c.checklistId).length === 0 ? (
                        <span className={styles.noChecks}>Sin checks completados</span>
                      ) : (
                        item.checks
                          .filter((c) => c.checklistId)
                          .map((c) => (
                            <Link
                              key={`${item.tripId}-${c.templateId}-${c.checklistId}`}
                              href={`/checklists/${c.checklistId}`}
                              className={`${styles.checkLink} ${styles[`checkLink${c.state}`]}`}
                              title={`Ver checklist ${templateLabel(c.templateId)}`}
                            >
                              <span className={`${styles.checkDot} ${approvalDotClass(c.approvalStatus)}`} aria-hidden />
                              <span>{String(c.templateTitle || templateLabel(c.templateId))}</span>
                            </Link>
                          ))
                      )}
                    </div>
                  </div>

                  <div
                    className={`${styles.badge} ${styles[`badge${item.status}`]}`}
                    title={statusLabel(item.status)}
                    aria-label={statusLabel(item.status)}
                  >
                    <span className={styles.statusIcon}>{statusIcon(item.status)}</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </ThemeShell>
  );
}

