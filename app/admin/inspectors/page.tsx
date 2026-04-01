"use client";

import ThemeShell from "@/components/checklists/ThemeShell";
import styles from "./page.module.css";

export default function InspectorAssignmentsPage() {
  return (
    <ThemeShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Administración</p>
            <h1>Módulo discontinuado</h1>
            <p className={styles.subtitle}>
              Ya no se asignan checklists por inspector. Todos los inspectores usan todos los checklists activos.
            </p>
          </div>
          <div className={styles.heroActions}>
            <a href="/dashboard" className={styles.secondaryBtn}>Volver al panel</a>
          </div>
        </section>
      </main>
    </ThemeShell>
  );
}
