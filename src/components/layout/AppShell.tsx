"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sun, Moon, Menu, Bell, Calendar, Clock, AlertTriangle, PanelLeftClose, PanelLeftOpen, LogOut } from "lucide-react";
import { logout, logActivityAsync, notificationsUpcomingCount, notificationsPendingCount, notificationsOverdueCount } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

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

function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: overdue = 0 } = useQuery({
    queryKey: ["notifications-overdue"],
    queryFn: notificationsOverdueCount,
    staleTime: 60_000,
  });
  const { data: upcoming = 0 } = useQuery({
    queryKey: ["notifications-upcoming"],
    queryFn: notificationsUpcomingCount,
    staleTime: 60_000,
  });
  const { data: pending = 0 } = useQuery({
    queryKey: ["notifications-pending"],
    queryFn: notificationsPendingCount,
    staleTime: 60_000,
  });
  const total = overdue + upcoming + pending;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-[var(--radius-sm)] p-2 text-[var(--color-text-secondary)] transition-all duration-[var(--speed-quick)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
        title="Notificações"
        aria-label="Notificações"
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 shadow-lg">
          <div className="px-3 pb-2 text-[var(--font-size-micro)] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Notificações
          </div>
          <Link
            href="/auditorias?status=em_atraso"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 text-[var(--font-size-small)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
              <AlertTriangle className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Auditorias em atraso</p>
              <p className="text-[var(--font-size-mini)] text-[var(--color-text-muted)]">
                {overdue} {overdue === 1 ? "auditoria" : "auditorias"} com data vencida
              </p>
            </div>
            {overdue > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--color-danger-bg)] px-2 py-0.5 text-[var(--font-size-mini)] font-medium text-[var(--color-danger)]">
                {overdue}
              </span>
            )}
          </Link>
          <Link
            href="/auditorias"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 text-[var(--font-size-small)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-info-bg)] text-[var(--color-info)]">
              <Calendar className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Próximas Auditorias</p>
              <p className="text-[var(--font-size-mini)] text-[var(--color-text-muted)]">
                {upcoming} {upcoming === 1 ? "auditoria" : "auditorias"} agendadas
              </p>
            </div>
            {upcoming > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 text-[var(--font-size-mini)] font-medium text-[var(--color-info)]">
                {upcoming}
              </span>
            )}
          </Link>
          <Link
            href="/auditorias"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 text-[var(--font-size-small)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Auditorias Pendentes</p>
              <p className="text-[var(--font-size-mini)] text-[var(--color-text-muted)]">
                {pending} {pending === 1 ? "auditoria" : "auditorias"} pendentes
              </p>
            </div>
            {pending > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[var(--font-size-mini)] font-medium text-[var(--color-warning)]">
                {pending}
              </span>
            )}
          </Link>
          {total === 0 && (
            <p className="px-3 py-4 text-center text-[var(--font-size-small)] text-[var(--color-text-muted)]">
              Nenhuma notificação
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { me } = useAuth();
  const isAdmin = me?.role === "admin_bim";

  async function signOut() {
    try {
      if (me) {
        logActivityAsync({
          userId: me.id,
          userName: me.name,
          userEmail: me.email,
          userRole: me.role,
          action: "LOGOUT",
          entity: "USUARIO",
          details: "Logout realizado",
        });
      }
      await logout();
      // Limpar cache do React Query para evitar que dados do usuário anterior
      // (ex: role admin) persistam ao fazer login com outra conta (ex: leitor)
      queryClient.clear();
      router.push("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      queryClient.clear();
      router.push("/login");
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)] overflow-x-hidden">
      <AppSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} collapsed={sidebarCollapsed} />
      <div className={cn("flex flex-1 flex-col min-w-0 transition-[margin] duration-[var(--speed-regular)]", sidebarCollapsed ? "lg:ml-16" : "lg:ml-[var(--sidebar-width)]")}>
        <header className={cn("fixed top-0 right-0 z-10 flex h-[60px] shrink-0 items-center justify-between gap-2 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-6 transition-[left] duration-[var(--speed-regular)]", sidebarCollapsed ? "left-0 lg:left-16" : "left-0 lg:left-[var(--sidebar-width)]")}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center rounded-[var(--radius-sm)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
              aria-label="Abrir menu"
            >
              <Menu className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="hidden lg:flex items-center justify-center rounded-[var(--radius-sm)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
              title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
              aria-label={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </button>
          </div>
          <nav className="flex items-center gap-1 ml-auto">
            <NotificationsDropdown />
            <div
              role="group"
              aria-label="Seleção de tema"
              className="flex items-center gap-0.5 rounded-[var(--radius-rounded)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1"
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`rounded-[var(--radius-rounded)] p-1.5 transition-all duration-[var(--speed-quick)] ${theme === "light" ? "bg-[var(--color-accent)] text-white shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"}`}
                title="Modo claro"
                aria-label="Ativar modo claro"
                aria-pressed={theme === "light"}
              >
                <Sun className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`rounded-[var(--radius-rounded)] p-1.5 transition-all duration-[var(--speed-quick)] ${theme === "dark" ? "bg-[var(--color-accent)] text-white shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"}`}
                title="Modo escuro"
                aria-label="Ativar modo escuro"
                aria-pressed={theme === "dark"}
              >
                <Moon className="size-[18px]" />
              </button>
            </div>
            {isAdmin && (
              <Link
                href="/configuracoes"
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-text-secondary)] transition-all duration-[var(--speed-quick)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
                title="Configurações (Admin)"
                aria-label="Configurações"
              >
                <SettingsIcon />
              </Link>
            )}
            <Link
              href="/perfil"
              className="rounded-[var(--radius-sm)] transition-all duration-[var(--speed-quick)] hover:bg-[var(--color-bg)]"
              title="Perfil"
              aria-label="Perfil"
            >
              {me?.avatarUrl ? (
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-border)] bg-[var(--color-bg)] transition-all duration-150 hover:border-[var(--color-accent)]">
                  <img src={me.avatarUrl} alt={me.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--font-size-mini)] font-semibold text-white">
                  {me?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 sm:px-3 text-[var(--font-size-small)] font-medium text-[var(--color-text-secondary)] transition-all duration-[var(--speed-quick)] hover:text-[var(--color-text-primary)]"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </nav>
        </header>
        <main className="flex-1 pt-[60px]">{children}</main>
      </div>
    </div>
  );
}
