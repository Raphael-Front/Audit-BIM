import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  ClipboardCheck,
  FileBarChart,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/obras", label: "Obras", icon: Building2 },
  { href: "/templates", label: "Biblioteca", icon: BookOpen },
  { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { theme } = useTheme();

  return (
    <Sidebar className="shrink-0">
      <SidebarHeader>
        <Link
          to="/dashboard"
          className="text-lg font-semibold tracking-tight text-[hsl(var(--macro))]"
        >
          BIM Audit
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {nav.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <SidebarMenuItem key={href}>
                <Link
                  to={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive &&
                      theme === "gpl" &&
                      "bg-[hsl(100_12%_75%)] text-[hsl(var(--macro))] hover:bg-[hsl(100_12%_75%)] hover:text-[hsl(var(--macro))]",
                    isActive &&
                      theme !== "gpl" &&
                      "bg-[hsl(262_50%_92%)] text-[hsl(var(--macro))] dark:bg-[hsl(262_30%_22%)] dark:text-[hsl(var(--macro))] hover:bg-[hsl(262_50%_92%)] hover:text-[hsl(var(--macro))] dark:hover:bg-[hsl(262_30%_22%)] dark:hover:text-[hsl(var(--macro))]",
                    !isActive &&
                      theme === "gpl" &&
                      "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(100_12%_80%)] hover:text-[hsl(var(--macro))]",
                    !isActive &&
                      theme !== "gpl" &&
                      "text-[hsl(var(--muted-foreground))] hover:bg-black/[0.05] hover:text-[hsl(var(--macro))] dark:hover:bg-white/[0.08]"
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:size-5">
                    <Icon />
                  </span>
                  <span className="truncate">{label}</span>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
