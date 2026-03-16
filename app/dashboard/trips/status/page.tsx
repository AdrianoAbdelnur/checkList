"use client";

import * as React from "react";
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
  observedCount: number;
  pendingCount: number;
  status: "RED" | "YELLOW" | "GREEN" | "NONE";
  checks: Array<{ templateId: string; state: "PENDING" | "OBSERVED" | "OK"; badCount: number }>;
};

function formatTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusLabel(status: TripStatusItem["status"]) {
  if (status === "RED") return "Rojo";
  if (status === "YELLOW") return "Amarillo";
  if (status === "GREEN") return "Verde";
  return "Sin checks";
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
          hasPermission(data.user as any, "checklist.view_all") ||
          hasAnyRole(data.user as any, ["admin", "supervisor", "reviewer"]);
        if (!allowed) {
          router.push("/dashboard");
          return;
        }

        if (cancelled) return;
        setMe(data.user);
        await load(dateKey);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error al cargar");
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
            <p className={styles.subtitle}>
              Semáforo por viaje según cumplimiento de checklists asignados.
            </p>
          </div>
          <div className={styles.actions}>
            <label className={styles.dateWrap}>
              <span>Fecha</span>
              <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
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

        <section className={styles.list}>
          {items.length === 0 ? (
            <div className={styles.empty}>No hay viajes para la fecha seleccionada.</div>
          ) : (
            items.map((item) => (
              <article key={item.tripId} className={styles.row}>
                <div className={styles.rowHead}>
                  <div>
                    <h3>{item.dominio || "-"}</h3>
                    <p>{item.tipo || "Viaje"}</p>
                  </div>
                  <div className={`${styles.badge} ${styles[`badge${item.status}`]}`}>
                    {statusLabel(item.status)}
                  </div>
                </div>
                <p className={styles.meta}>
                  Asignados: {item.expectedCount} · Realizados: {item.completedCount} · Pendientes: {item.pendingCount} · Observados: {item.observedCount}
                </p>
              </article>
            ))
          )}
        </section>
      </main>
    </ThemeShell>
  );
}

