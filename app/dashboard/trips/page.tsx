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

export default function TripsHomePage() {
  const router = useRouter();
  const [me, setMe] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

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

        if (!cancelled) setMe(data.user);
      } catch {
        router.push("/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <ThemeShell user={me}>
        <main className={styles.page}>
          <div className={styles.loading}>Cargando modulo de viajes...</div>
        </main>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={me}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Operación diaria</p>
            <h1>Viajes</h1>
            <p className={styles.subtitle}>
              Elegí el flujo que querés usar para trabajar con viajes del día.
            </p>
          </div>
          <a href="/dashboard" className={styles.secondaryBtn}>Volver al panel</a>
        </section>

        <section className={styles.cards}>
          <a href="/dashboard/trips/upload" className={styles.card}>
            <p className={styles.cardKicker}>Importacion</p>
            <h3>Cargar viajes</h3>
            <p>Subi Excel, valida por fecha y guarda viajes en base de datos.</p>
          </a>

          <a href="/dashboard/trips/assign" className={styles.card}>
            <p className={styles.cardKicker}>Planificacion</p>
            <h3>Asignar viajes</h3>
            <p>Matriz de viajes vs checklists para definir que inspeccion requiere cada viaje.</p>
          </a>

          <a href="/dashboard/trips/status" className={styles.card}>
            <p className={styles.cardKicker}>Seguimiento</p>
            <h3>Estado de viajes</h3>
            <p>Semáforo operativo por viaje: rojo, amarillo o verde según cumplimiento de checks.</p>
          </a>
        </section>
      </main>
    </ThemeShell>
  );
}
