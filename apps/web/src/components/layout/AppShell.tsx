import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon } from "lucide-react";
import { logout, authMe, type MeResponse } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { AppSidebar } from "./AppSidebar";

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
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { data: me } = useQuery<MeResponse>({
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
      navigate("/login");
    }
  }

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-end gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 md:px-6">
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-1.5 dark:border-[hsl(var(--border))] dark:bg-[hsl(var(--muted))]/30"
              title={theme === "light" ? "Tema escuro" : "Tema claro"}
              aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
            >
              <span className={`rounded-md p-1.5 transition-colors ${theme === "light" ? "bg-[hsl(var(--card))] text-[hsl(var(--macro))] shadow-sm" : "text-[hsl(var(--muted-foreground))]"}`}>
                <Sun className="size-[18px]" />
              </span>
              <span className={`rounded-md p-1.5 transition-colors ${theme === "dark" ? "bg-[hsl(var(--card))] text-[hsl(var(--macro))] shadow-sm dark:bg-[hsl(var(--card))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                <Moon className="size-[18px]" />
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
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[hsl(var(--border))] bg-[hsl(var(--muted))] transition-colors hover:border-[hsl(var(--accent))]">
                  <img src={me.avatarUrl} alt={me.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="p-2 text-[hsl(var(--muted-foreground))]">
                  <UserIcon />
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--macro))] transition-colors hover:bg-black/[0.05] hover:opacity-90 dark:hover:bg-white/[0.08]"
            >
              Sair
            </button>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
