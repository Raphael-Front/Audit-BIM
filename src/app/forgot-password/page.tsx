"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { forgotPassword } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase/client";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const cardClass = "login-card-theme";

  useEffect(() => {
    try {
      createSupabaseClient().auth.signOut({ scope: "local" });
    } catch {
      /* ignora */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      let msg = "Erro ao enviar email de recuperação.";
      if (err instanceof Error && err.message) {
        msg = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        const m = (err as { message: unknown }).message;
        if (typeof m === "string" && m && m !== "{}") msg = m;
      }
      if (
        msg === "{}" ||
        msg.includes("504") ||
        msg.toLowerCase().includes("timeout") ||
        msg.toLowerCase().includes("gateway") ||
        msg.toLowerCase().includes("aborted") ||
        msg.toLowerCase().includes("signal is aborted") ||
        msg.toLowerCase().includes("refresh token")
      ) {
        msg = "Sessão expirada ou inválida. Feche outras abas do app, limpe os dados do site no navegador e tente novamente.";
      }
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen-content">
        <div className="login-screen-card-wrapper">
          <div className={`${cardClass} w-full space-y-4`}>
            <div className="login-card-logo">
              <img src="/audit-bim-logo-azul.png" alt="AUDIT BIM" className="h-auto w-full max-w-[240px] mx-auto" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[hsl(var(--login-card-foreground))]">Recuperar Senha</h1>
              <p className="mt-1 text-sm text-[hsl(var(--login-card-muted))]">Digite seu email para receber instruções</p>
            </div>
            {success ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">Se o email existir em nossa base, você receberá um link para redefinir sua senha.</p>
                </div>
                <Link href="/login" className="login-card-btn inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 font-medium hover:opacity-90 transition-colors">
                  <NavArrowIcon direction="back" className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(e).catch(() => {});
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Email</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className="login-card-input mt-1 block w-full rounded-xl border px-3 py-2 placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]" placeholder="seu@email.com" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="login-card-btn w-full rounded-xl px-4 py-2.5 font-medium hover:opacity-90 disabled:opacity-50 transition-colors">
                  {loading ? "Enviando…" : "Enviar instruções"}
                </button>
                <div className="text-center pt-1">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--login-card-muted))] hover:text-[hsl(var(--login-card-foreground))] transition-colors">
                    <NavArrowIcon direction="back" className="h-4 w-4" />
                    Voltar para o login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
