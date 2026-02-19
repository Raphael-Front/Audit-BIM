import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "@/lib/api";
import { useState, useEffect } from "react";
import { CubeLogo } from "@/components/CubeLogo";
import { createSupabaseClient } from "@/lib/supabase/client";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Verificar se há um token válido na URL (Supabase adiciona hash fragments)
    const supabase = createSupabaseClient();
    
    // Verificar hash fragments primeiro (Supabase usa isso para recovery links)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && type === "recovery" && refreshToken) {
      // Trocar o código de recuperação por uma sessão
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(({ error: sessionError }) => {
          if (sessionError) {
            setError("Link inválido ou expirado. Solicite um novo link de recuperação.");
            setValidating(false);
          } else {
            setValidating(false);
          }
        });
    } else {
      // Verificar se já há uma sessão válida
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setValidating(false);
        } else {
          setError("Link inválido ou expirado. Solicite um novo link de recuperação.");
          setValidating(false);
        }
      });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
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
      setTimeout(() => {
        navigate("/login");
      }, 2000);
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
          <div className="cube-wrapper mb-4">
            <CubeLogo />
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">Validando link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="login-screen">
        <div className="login-screen-content">
          <div className="cube-wrapper mb-4">
            <CubeLogo />
          </div>
          <p className="mb-6 text-center text-base font-medium text-[hsl(var(--muted-foreground))]">Precisão em cada face do modelo.</p>
          <div className="w-full max-w-sm space-y-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--macro))]">Link Inválido</h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
            </div>
            <Link
              to="/forgot-password"
              className="block w-full text-center rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-colors"
            >
              Solicitar novo link
            </Link>
            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Voltar para o login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-screen-content">
        <div className="cube-wrapper mb-4">
          <CubeLogo />
        </div>
        <p className="mb-6 text-center text-base font-medium text-[hsl(var(--muted-foreground))]">Precisão em cada face do modelo.</p>
        <div className="w-full max-w-sm space-y-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--macro))]">Redefinir Senha</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Digite sua nova senha</p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Senha redefinida com sucesso! Redirecionando para o login...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[hsl(var(--foreground))]">Nova Senha</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  className="mt-1 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[hsl(var(--foreground))]">Confirmar Senha</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  placeholder="Digite a senha novamente"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Redefinindo…" : "Redefinir senha"}
              </button>
              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

