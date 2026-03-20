"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  ClipboardCheck,
  FileBarChart,
} from "lucide-react";
import { X } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck },
      { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/obras", label: "Obras", icon: Building2 },
      { href: "/templates", label: "Biblioteca", icon: BookOpen },
    ],
  },
];

function CubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
}

export function AppSidebar({ mobileOpen = false, onMobileClose, collapsed = false }: AppSidebarProps) {
  const pathname = usePathname();

  const linkClasses = (isActive: boolean) =>
    cn(
      "flex items-center text-[var(--font-size-small)] font-normal transition-all",
      collapsed ? "justify-center p-1.5 mx-1.5 rounded-[var(--radius-sm)]" : "gap-[var(--space-2)] px-5 py-1.5 rounded-[var(--radius-sm)]",
      isActive
        ? "bg-[rgba(113,128,255,0.12)] text-[var(--color-accent)] font-[var(--font-weight-medium)]"
        : "text-[var(--color-text-secondary)] [&>svg]:opacity-70 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-[var(--color-text-primary)]"
    );

  const sidebarContent = (
    <>
      <SidebarHeader className={cn("flex flex-row items-center justify-between border-b border-[var(--color-border)] h-[60px] px-5 w-full shrink-0", collapsed && "lg:justify-center lg:px-2")}>
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className={cn(
            "flex items-center text-[var(--color-text-primary)] -ml-1 w-full min-w-0",
            collapsed ? "justify-center p-0 -ml-0 w-auto" : "gap-3"
          )}
          title="BIM Audit"
        >
          <CubeIcon className={cn("shrink-0 text-[var(--color-accent)]", collapsed ? "h-6 w-6" : "h-7 w-7")} />
          {!collapsed && <span className="text-[var(--font-size-large)] font-[var(--font-weight-semibold)] tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>BIM Audit</span>}
        </Link>
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden flex items-center justify-center rounded-[var(--radius-sm)] p-2 text-[var(--color-text-secondary)] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-[var(--color-text-primary)]"
          aria-label="Fechar menu"
        >
          <X className="size-5" />
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className={cn(collapsed && "px-0")}>
          {sections.flatMap(({ title, items }, idx) => [
            ...(!collapsed
              ? [
                  <li
                    key={`${title}-header`}
                    className={cn(
                      "px-5 pt-2 pb-1",
                      idx === 0 && "pt-0"
                    )}
                  >
                    <span className="text-[0.625rem] font-[var(--font-weight-semibold)] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                      {title}
                    </span>
                  </li>,
                ]
              : []),
            ...items.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <SidebarMenuItem key={href}>
                  <Link href={href} onClick={onMobileClose} className={linkClasses(isActive)} title={collapsed ? label : undefined}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:size-5">
                      <Icon />
                    </span>
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                </SidebarMenuItem>
              );
            }),
          ])}
        </SidebarMenu>
      </SidebarContent>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === "Escape" && onMobileClose?.()}
          role="button"
          tabIndex={0}
          aria-label="Fechar menu"
        />
      )}
      <Sidebar
        className={cn(
          "fixed left-0 top-0 z-30 h-screen shrink-0 transform border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-[width] duration-250 ease-[var(--ease-out-cubic)]",
          collapsed ? "lg:w-16" : "w-[var(--sidebar-width)]",
          mobileOpen ? "translate-x-0 w-[var(--sidebar-width)]" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ visibility: "visible" }}
      >
        {sidebarContent}
      </Sidebar>
    </>
  );
}
