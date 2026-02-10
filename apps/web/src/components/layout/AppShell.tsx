import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/obras", label: "Obras" },
  { href: "/templates", label: "Biblioteca" },
  { href: "/auditorias", label: "Auditorias" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))]">
      <header className="border-b border-[hsl(var(--border))]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            BIM Audit Cloud
          </Link>
          <nav className="flex items-center gap-6">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={`text-sm font-medium ${pathname.startsWith(href) ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
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
