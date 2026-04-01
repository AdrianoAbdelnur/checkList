"use client";

import ThemeShell from "@/components/checklists/ThemeShell";
import styles from "./page.module.css";

export default function AssignTripsPage() {
  return (
    <ThemeShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Planificación</p>
            <h1>Módulo discontinuado</h1>
            <p className={styles.subtitle}>
              Ya no se asignan viajes por inspector. El estado de viajes se calcula automáticamente por patente y checks enviados.
            </p>
          </div>
          <div className={styles.heroActions}>
            <a href="/dashboard/trips/status" className={styles.primaryBtn}>Ir a Estado de viajes</a>
            <a href="/dashboard/trips" className={styles.secondaryBtn}>Volver</a>
          </div>
        </section>
      </main>
    </ThemeShell>
  );
}
