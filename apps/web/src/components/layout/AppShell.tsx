import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logout, authMe, type MeResponse } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/obras", label: "Obras" },
  { href: "/templates", label: "Biblioteca" },
  { href: "/auditorias", label: "Auditorias" },
  { href: "/relatorios", label: "Relatórios" },
];

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const { data: me, error: meError } = useQuery<MeResponse>({ 
    queryKey: ["me"], 
    queryFn: authMe,
    retry: 3,
    refetchOnWindowFocus: true,
  });
  const isAdmin = me?.role === "admin_bim";

  async function signOut() {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      // Mesmo com erro, redirecionar para login
      navigate("/login");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))]">
      <header className="border-b border-[hsl(var(--border))]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight text-[hsl(var(--macro))]">
            BIM Audit
          </Link>
          <nav className="flex items-center gap-6">
            {nav.map(({ href, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  to={href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? theme === "gpl"
                        ? "bg-[hsl(100_12%_75%)] text-[hsl(var(--macro))]"
                        : "bg-[hsl(262_50%_92%)] text-[hsl(var(--macro))] dark:bg-[hsl(262_30%_22%)] dark:text-[hsl(var(--macro))]"
                      : theme === "gpl"
                      ? "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(100_12%_80%)] hover:text-[hsl(var(--macro))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-black/[0.05] hover:text-[hsl(var(--macro))] dark:hover:bg-white/[0.08]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="ml-2 flex items-center gap-1 border-l border-[hsl(var(--border))] pl-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-1.5 dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--muted))]/30"
                title={theme === "light" ? "Tema escuro" : "Tema claro"}
                aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
              >
                <span className={`rounded-md p-1.5 transition-colors ${theme === "light" ? "bg-[hsl(var(--card))] text-[hsl(var(--macro))] shadow-sm" : "text-[hsl(var(--muted-foreground))]"}`}>
                  <SunIcon />
                </span>
                <span className={`rounded-md p-1.5 transition-colors ${theme === "dark" ? "bg-[hsl(var(--card))] text-[hsl(var(--macro))] shadow-sm dark:bg-[hsl(var(--card))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                  <MoonIcon />
                </span>
              </button>
              {isAdmin && (
                <Link
                  to="/configuracoes"
                  className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-black/[0.05] hover:text-[hsl(var(--macro))] dark:hover:bg-white/[0.08]"
                  title="Configurações (Admin)"
                  aria-label="Configurações"
                >
                  <SettingsIcon />
                </Link>
              )}
              <Link
                to="/perfil"
                className="rounded-lg transition-colors hover:bg-black/[0.05] hover:text-[hsl(var(--macro))] dark:hover:bg-white/[0.08]"
                title="Perfil"
                aria-label="Perfil"
              >
                {me?.avatarUrl ? (
                  <div className="h-9 w-9 rounded-full overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--accent))] transition-colors">
                    <img src={me.avatarUrl} alt={me.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="p-2 text-[hsl(var(--muted-foreground))]">
                    <UserIcon />
                  </div>
                )}
              </Link>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--macro))] transition-colors hover:bg-black/[0.05] hover:opacity-90 dark:hover:bg-white/[0.08]"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
