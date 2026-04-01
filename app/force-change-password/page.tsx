"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.user) {
          router.replace("/login");
          return;
        }
        if (!data?.user?.mustChangePassword) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setError(null);

    if (!currentPassword.trim() || !newPassword.trim()) {
      setError("Completá la contraseña actual y la nueva.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "No se pudo actualizar la contraseña.");
      }
      router.replace("/dashboard");
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1220] text-white grid place-items-center px-4">
        <div className="text-sm font-bold text-slate-300">Verificando sesión...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[18px] border border-slate-700/60 bg-[#111827] p-4 space-y-3">
        <h1 className="text-2xl font-black">Cambiar contraseña</h1>
        <p className="text-sm text-slate-300 font-semibold">
          Debés actualizar tu contraseña para continuar.
        </p>

        <div>
          <label className="text-[11px] font-black tracking-[0.18em] text-slate-300">ACTUAL</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-2 w-full h-12 rounded-[12px] border border-slate-700/60 bg-[#0f172a] px-3 outline-none font-extrabold"
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="text-[11px] font-black tracking-[0.18em] text-slate-300">NUEVA</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-2 w-full h-12 rounded-[12px] border border-slate-700/60 bg-[#0f172a] px-3 outline-none font-extrabold"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="text-[11px] font-black tracking-[0.18em] text-slate-300">CONFIRMAR</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-2 w-full h-12 rounded-[12px] border border-slate-700/60 bg-[#0f172a] px-3 outline-none font-extrabold"
            autoComplete="new-password"
          />
        </div>

        {error ? <div className="text-sm font-black text-red-400">{error}</div> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 rounded-[12px] bg-blue-600 hover:bg-blue-500 disabled:opacity-70 font-black"
        >
          {saving ? "GUARDANDO..." : "ACTUALIZAR CONTRASEÑA"}
        </button>
      </form>
    </div>
  );
}

