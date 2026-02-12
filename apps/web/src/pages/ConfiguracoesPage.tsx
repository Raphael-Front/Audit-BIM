import { Container } from "@/components/layout/Container";
import { useTheme } from "@/contexts/ThemeContext";

export function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();

  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[hsl(var(--macro))]">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Preferências da aplicação
        </p>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Aparência</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Escolha o tema claro ou escuro da interface.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              theme === "light"
                ? "border-[hsl(var(--accent))] bg-[hsl(262_50%_92%)] text-[hsl(var(--macro))] dark:border-[hsl(var(--accent))] dark:bg-[hsl(262_30%_22%)]"
                : "border-[hsl(var(--border))] bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Tema claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              theme === "dark"
                ? "border-[hsl(var(--accent))] bg-[hsl(262_50%_92%)] text-[hsl(var(--macro))] dark:border-[hsl(var(--accent))] dark:bg-[hsl(262_30%_22%)]"
                : "border-[hsl(var(--border))] bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Tema escuro
          </button>
        </div>
      </div>
    </Container>
  );
}
