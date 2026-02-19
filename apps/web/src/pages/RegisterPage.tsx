import { useNavigate, Link } from "react-router-dom";
import { register, setToken } from "@/lib/api";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export function RegisterPage() {
  const { theme } = useTheme();
  const cardClass = theme === "gpl" ? "login-card-gpl" : "login-card-theme";
  const [email, setEmail] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    if (nomeCompleto.trim().length < 2) {
      setError("O nome completo deve ter pelo menos 2 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { accessToken } = await register(email, password, nomeCompleto);
      if (accessToken) setToken(accessToken);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen-content">
        <div aria-hidden="true" />
        <div className="login-screen-card-wrapper">
          <div className={`${cardClass} w-full max-w-sm space-y-8 rounded-2xl border p-8 shadow-lg backdrop-blur-sm`}>
            <div>
              <p className="text-sm text-[hsl(var(--login-card-muted))]">Crie sua conta</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nomeCompleto" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Nome Completo</label>
                <input
                  id="nomeCompleto"
                  type="text"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                  autoFocus
                  className="login-card-input mt-1 block w-full rounded-xl border px-3 py-2 placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]"
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-card-input mt-1 block w-full rounded-xl border px-3 py-2 placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]"
                  placeholder="seu@email.com"
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
                  minLength={6}
                  className="login-card-input mt-1 block w-full rounded-xl border px-3 py-2 placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[hsl(var(--login-card-foreground))]">Confirmar Senha</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="login-card-input mt-1 block w-full rounded-xl border px-3 py-2 placeholder:text-[hsl(var(--login-card-muted)/0.7)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--login-card-ring))]"
                  placeholder="Digite a senha novamente"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="login-card-btn w-full rounded-xl px-4 py-2 font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Criando conta…" : "Criar conta"}
              </button>
              <p className="text-center text-sm text-[hsl(var(--login-card-muted))]">
                Já tem uma conta?{" "}
                <Link
                  to="/login"
                  className="font-medium text-[hsl(var(--login-card-foreground))] hover:underline transition-colors"
                >
                  Entrar
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

