import { useNavigate, Link } from "react-router-dom";
import { forgotPassword } from "@/lib/api";
import { useState } from "react";
import { CubeLogo } from "@/components/CubeLogo";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email de recuperação");
    } finally {
      setLoading(false);
    }
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
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--macro))]">Recuperar Senha</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Digite seu email para receber instruções</p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Se o email existir em nossa base, você receberá um link para redefinir sua senha.
                </p>
              </div>
              <Link
                to="/login"
                className="block w-full text-center rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-colors"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--foreground))]">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="mt-1 block w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                  placeholder="seu@email.com"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Enviando…" : "Enviar instruções"}
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

