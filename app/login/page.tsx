import LoginForm from "../../components/LoginForm";
import { Suspense } from "react";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path
                d="M9 3h6l1 2h3v16H5V5h3l1-2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9 7h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M8 11h8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M8 15h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="flex-1">
            <div className="text-2xl font-black leading-tight">Checklists</div>
            <div className="text-xs font-extrabold text-slate-300 mt-1">
              Iniciá sesión para continuar
            </div>
          </div>
        </div>

        <div className="rounded-[18px] border border-slate-700/60 bg-[#111827] p-4">
          <Suspense fallback={<div className="text-sm text-slate-300">Cargando...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        <div className="text-center text-[10px] font-extrabold tracking-[0.22em] text-slate-400 uppercase mt-4">
          TrailingSat · Checklists
        </div>
      </div>
    </div>
  );
}
