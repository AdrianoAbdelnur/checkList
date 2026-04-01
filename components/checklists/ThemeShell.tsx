"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { roleLabelEs } from "@/lib/roles";
import styles from "./ThemeShell.module.css";

type ThemeMode = "dark" | "light";
type HeaderUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  mustChangePassword?: boolean;
} | null;

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem("checklists-theme");
  return saved === "light" ? "light" : "dark";
}

function getUserLabel(user: HeaderUser) {
  if (!user) return "Sin sesion";
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email || "Usuario";
}

export default function ThemeShell({
  children,
  user = null,
  initialTheme = "dark",
}: {
  children: React.ReactNode;
  user?: HeaderUser;
  initialTheme?: ThemeMode;
}) {
  const [theme, setTheme] = React.useState<ThemeMode>(initialTheme);
  const [hydrated, setHydrated] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    const clientTheme = getInitialTheme();
    setTheme(clientTheme);
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    window.localStorage.setItem("checklists-theme", theme);
    document.cookie = `checklists-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [theme, hydrated]);

  React.useEffect(() => {
    let cancelled = false;
    if (!pathname || pathname === "/login" || pathname === "/force-change-password") return;
    async function enforcePasswordChange() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.user?.mustChangePassword) {
          router.replace("/force-change-password");
        }
      } catch {
        // noop
      }
    }
    enforcePasswordChange();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const showBackButton = !!pathname && pathname !== "/dashboard";

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.push("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className={styles.shell} data-theme={theme}>
      <header className={styles.header}>
        <div className={styles.toolbar}>
          <div className={styles.leftCluster}>
            <Link href="/dashboard" className={styles.brand}>
              <span className={styles.brandDot} aria-hidden />
              <span>Checklists</span>
            </Link>
            <div className={styles.userBox}>
              <div className={styles.userMain}>{getUserLabel(user)}</div>
              <div className={styles.userSub}>
                {user?.role ? roleLabelEs(user.role) : user?.email ?? "Invitado"}
              </div>
            </div>
          </div>

          <div className={styles.centerCluster}>
            {showBackButton ? (
              <button type="button" className={styles.backBtn} onClick={handleBack}>
                Volver
              </button>
            ) : null}
          </div>

          <div className={styles.rightCluster}>
            <button
              type="button"
              className={styles.toggle}
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-pressed={theme === "light"}
              title={theme === "dark" ? "Modo oscuro (clic para claro)" : "Modo claro (clic para oscuro)"}
            >
              <svg
                viewBox="0 0 24 24"
                className={styles.toggleIcon}
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {theme === "dark" ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </>
                ) : (
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
                )}
              </svg>
            </button>

            {user ? (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label={loggingOut ? "Cerrando sesion" : "Cerrar sesion"}
                title={loggingOut ? "Cerrando sesion..." : "Cerrar sesion"}
              >
                {loggingOut ? (
                  <span className={styles.spinner} aria-hidden />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className={styles.toggleIcon}
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
