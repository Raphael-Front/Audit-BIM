"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import { validatePasswordStrong, PASSWORD_HINT } from "@/lib/validation";
import { useState, useEffect } from "react";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const router = useRouter();
  const cardClass = "login-card-theme";

  useEffect(() => {
    const supabase = createSupabaseClient();
    const hashParams = new URLSearchParams(typeof window !== "undefined" ? window.location.hash.substring(1) : "");
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && type === "recovery" && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error: sessionError }) => {
        if (sessionError) {
          setError("Link inválido ou expirado. Solicite um novo link de recuperação.");
        }
        setValidating(false);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) setError("Link inválido ou expirado. Solicite um novo link de recuperação.");
        setValidating(false);
      });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pwdValidation = validatePasswordStrong(password);
    if (!pwdValidation.valid) {
      setError(pwdValidation.message ?? "Senha inválida");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="login-screen">
        <div className="login-screen-content">
          <div className="login-screen-card-wrapper">
            <div className={`${cardClass} w-full space-y-5 rounded-xl px-6 py-5`}>
              <p className="text-center text-sm text-[hsl(var(--login-card-muted))]">Validando link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="login-screen">
        <div className="login-screen-content">
          <div className="login-screen-card-wrapper">
            <div className={`${cardClass} w-full space-y-5 rounded-xl px-6 py-5`}>
              <div>
                <p className="text-sm text-[hsl(var(--login-card-muted))]">Link inválido ou expirado</p>
                <p className="mt-1 text-sm text-[hsl(var(--login-card-foreground))]">{error}</p>
              </div>
              <Link href="/forgot-password" className="login-card-btn block w-full rounded-xl px-6 py-2.5 text-center text-base font-medium hover:opacity-90 transition-colors">
                Solicitar novo link
              </Link>
              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--login-card-muted))] hover:text-[hsl(var(--login-card-foreground))] transition-colors">
                  <NavArrowIcon direction="back" className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-screen-content">
        <div className="login-screen-card-wrapper">
          <div className={`${cardClass} w-full space-y-5 rounded-xl px-6 py-5`}>
            <div>
              <p className="text-sm text-[hsl(var(--login-card-muted))]">Redefinir senha</p>
            </div>
            {success ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">Senha redefinida com sucesso! Redirecionando para o login...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Nova Senha</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoFocus className="login-card-input mt-1 block w-full rounded-xl border placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]" placeholder={PASSWORD_HINT} />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Confirmar Senha</label>
                  <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="login-card-input mt-1 block w-full rounded-xl border placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]" placeholder="Digite a senha novamente" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="login-card-btn w-full rounded-xl px-6 py-2.5 text-base font-medium hover:opacity-90 disabled:opacity-50 transition-colors">
                  {loading ? "Redefinindo…" : "Redefinir senha"}
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
