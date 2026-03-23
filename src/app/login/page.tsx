"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { login, setToken, resendConfirmationEmail } from "@/lib/api";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { status } = useAuth();

  const cardClass = "login-card-theme";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { accessToken } = await login(email, password);
      if (accessToken) {
        setToken(accessToken);
        queryClient.removeQueries({ queryKey: ["me"] });
        // A navegação acontece via useEffect quando o AuthContext confirmar status="authenticated"
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Credenciais inválidas";
      setError(msg);
      if (msg.toLowerCase().includes("email") && msg.toLowerCase().includes("confirm")) {
        setResendEmail(email);
        setShowResend(true);
      }
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
              <img src={theme === "dark" ? "/audit-bim-logo-azul.png" : "/audit-bim-logo-azul.png"} alt="AUDIT BIM" className="h-auto w-full max-w-[240px] mx-auto" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-card-input mt-1 block w-full rounded-xl border placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Senha</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-card-input mt-1 block w-full rounded-xl border placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="login-card-btn w-full rounded-xl px-6 py-2.5 text-base font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Entrando…" : "Entrar"}
              </button>
              <div className="space-y-2 pt-1 text-center">
                <Link href="/forgot-password" className="block text-sm text-[hsl(var(--login-card-muted))] hover:text-[hsl(var(--login-card-foreground))] transition-colors">
                  Esqueceu sua senha?
                </Link>
                <p className="text-sm text-[hsl(var(--login-card-muted))]">
                  Não tem uma conta?{" "}
                  <Link href="/register" className="font-medium text-[hsl(var(--login-card-foreground))] hover:underline transition-colors">
                    Criar conta
                  </Link>
                </p>
                {!showResend ? (
                  <button
                    type="button"
                    onClick={() => setShowResend(true)}
                    className="text-sm text-[hsl(var(--login-card-muted))] hover:text-[hsl(var(--login-card-foreground))] transition-colors"
                  >
                    Não recebeu o email de confirmação? Reenviar
                  </button>
                ) : (
                  <div className="space-y-2 border-t border-[hsl(var(--login-card-muted)/0.3)] pt-3 mt-2">
                    <p className="text-xs text-[hsl(var(--login-card-muted))]">Reenviar email de confirmação</p>
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="login-card-input block w-full rounded-xl border px-3 py-2 text-sm placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]"
                    />
                    {resendSuccess && <p className="text-xs text-green-600 dark:text-green-400">Email reenviado. Verifique sua caixa de entrada.</p>}
                    {resendError && <p className="text-xs text-red-600">{resendError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={resendLoading}
                        onClick={async () => {
                          setResendError("");
                          setResendSuccess(false);
                          if (!resendEmail.trim()) return;
                          setResendLoading(true);
                          try {
                            await resendConfirmationEmail(resendEmail.trim());
                            setResendSuccess(true);
                          } catch (e) {
                            setResendError(e instanceof Error ? e.message : "Erro ao reenviar");
                          } finally {
                            setResendLoading(false);
                          }
                        }}
                        className="flex-1 rounded-xl bg-[hsl(var(--login-card-muted)/0.2)] px-3 py-2 text-sm font-medium text-[hsl(var(--login-card-foreground))] hover:opacity-90 disabled:opacity-50"
                      >
                        {resendLoading ? "Enviando…" : "Reenviar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowResend(false); setResendError(""); setResendSuccess(false); }}
                        className="rounded-xl px-3 py-2 text-sm text-[hsl(var(--login-card-muted))] hover:text-[hsl(var(--login-card-foreground))]"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
