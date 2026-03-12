"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/checklists/ThemeShell";
import styles from "./page.module.css";

type SessionUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
};

const methods = [
  {
    title: "Edicion visual",
    description: "Crear o editar templates desde el formulario visual.",
    href: "/templates/edition/visual",
    cta: "Abrir editor",
  },
  {
    title: "Importar archivo JSON",
    description: "Subir un archivo .json y cargarlo al editor.",
    href: "/templates/edition/file",
    cta: "Ir a carga por archivo",
  },
  {
    title: "Pegar JSON",
    description: "Pegar contenido JSON en un input grande para importar.",
    href: "/templates/edition/json",
    cta: "Ir a carga por texto",
  },
];

function getUserLabel(user: SessionUser | null) {
  if (!user) return "Usuario";
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

export default function TemplatesEditionPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<SessionUser | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
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
        if (!cancelled) setUser(meJson.user);
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
      <ThemeShell>
        <div className={styles.loading}>Cargando metodos...</div>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell user={user}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Templates · Edition</p>
          <h1>Elegi metodo de trabajo</h1>
          <p>
            Usuario: <strong>{getUserLabel(user)}</strong>. Selecciona como queres cargar o editar el template.
          </p>
        </section>

        <section className={styles.grid}>
          {methods.map((method) => (
            <article key={method.href} className={styles.card}>
              <h2>{method.title}</h2>
              <p>{method.description}</p>
              <Link href={method.href} className={styles.cta}>
                {method.cta}
              </Link>
            </article>
          ))}
        </section>
      </main>
    </ThemeShell>
  );
}
