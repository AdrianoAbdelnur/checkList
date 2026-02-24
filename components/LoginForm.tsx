"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "./Button";
import { validateEmail, validatePassword } from "../lib/validators";

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function FieldShell({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 rounded-[14px] border border-slate-700/60 bg-[#0f172a] flex items-stretch overflow-hidden">
      <div className="w-10 grid place-items-center">{icon}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();

  const danger = "#ef4444";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length >= 4 && !loading;
  }, [email, password, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fe: { email?: string; password?: string } = {};
    if (!validateEmail(email)) fe.email = "Email inválido";
    if (!validatePassword(password)) fe.password = "Contraseña requerida";
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Credenciales inválidas");
      }

      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Error de login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <div className="text-[11px] font-black tracking-[0.18em] text-slate-300">
          EMAIL
        </div>

        <FieldShell
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-300">
              <path
                d="M4 6h16v12H4V6Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M4 8l8 5 8-5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            className="w-full h-12.5 bg-transparent outline-none text-white font-extrabold placeholder:text-slate-400"
            placeholder="tu@email.com"
          />
        </FieldShell>

        {fieldErrors.email ? (
          <div className="mt-1 text-sm font-extrabold text-red-400">
            {fieldErrors.email}
          </div>
        ) : null}
      </div>

      <div className="pt-1">
        <div className="text-[11px] font-black tracking-[0.18em] text-slate-300">
          CONTRASEÑA
        </div>

        <div className="mt-2 rounded-[14px] border border-slate-700/60 bg-[#0f172a] flex items-stretch overflow-hidden">
          <div className="w-10 grid place-items-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-300">
              <path
                d="M6 11h12v9H6v-9Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M8 11V8a4 4 0 1 1 8 0v3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            className="flex-1 h-12.5 bg-transparent outline-none text-white font-extrabold placeholder:text-slate-400"
            placeholder="••••••••"
          />

          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="w-12 grid place-items-center border-l border-slate-700/60 hover:bg-white/5 active:scale-[0.99]"
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPass ? (
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-300">
                <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M10.5 10.7a2.8 2.8 0 0 0 3.8 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path
                  d="M7.1 7.2C4.3 9 2.5 12 2.5 12s3.5 7 9.5 7c1.7 0 3.2-.3 4.5-.9"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.2 5.3A10.2 10.2 0 0 1 12 5c6 0 9.5 7 9.5 7a15.4 15.4 0 0 1-3.1 4.1"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-300">
                <path
                  d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
          </button>
        </div>

        {fieldErrors.password ? (
          <div className="mt-1 text-sm font-extrabold text-red-400">
            {fieldErrors.password}
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-[14px] border px-3 py-2 flex items-center gap-2"
          style={{ borderColor: danger, background: hexToRgba(danger, 0.08), color: danger }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5">
            <path
              d="M12 2.5c5.2 0 9.5 4.3 9.5 9.5S17.2 21.5 12 21.5 2.5 17.2 2.5 12 6.8 2.5 12 2.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="M12 7v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M12 17h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <div className="font-black text-sm">{error}</div>
        </div>
      ) : null}

      <div className="pt-1">
        <Button type="submit" loading={loading} disabled={!canSubmit}>
          {loading ? "INGRESANDO..." : "INGRESAR"}
        </Button>
      </div>
    </form>
  );
}
