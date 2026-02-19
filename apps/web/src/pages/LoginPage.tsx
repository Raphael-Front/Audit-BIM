import { useNavigate, Link } from "react-router-dom";
import { login, setToken } from "@/lib/api";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  const cardClass = theme === "gpl" ? "login-card-gpl" : "login-card-theme";

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
      if (accessToken) setToken(accessToken);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen-content">
        <div aria-hidden="true" />
        <div className="login-screen-card-wrapper">
        <div className={`${cardClass} w-full space-y-5 rounded-xl px-6 py-5`}>
        <div>
          <p className="text-sm text-[hsl(var(--login-card-muted))]">Entre com sua conta</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
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
            <Link
              to="/forgot-password"
              className="block text-sm text-[hsl(var(--login-card-muted))] hover:text-[hsl(var(--login-card-foreground))] transition-colors"
            >
              Esqueceu sua senha?
            </Link>
            <p className="text-sm text-[hsl(var(--login-card-muted))]">
              Não tem uma conta?{" "}
              <Link
                to="/register"
                className="font-medium text-[hsl(var(--login-card-foreground))] hover:underline transition-colors"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </form>
        </div>
        </div>
      </div>
    </div>
  );
}
