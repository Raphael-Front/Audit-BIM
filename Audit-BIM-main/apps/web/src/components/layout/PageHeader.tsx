interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Cor do título: 'macro' (acento) ou 'foreground' (padrão) */
  titleVariant?: "macro" | "foreground";
}

export function PageHeader({ title, subtitle, actions, titleVariant = "macro" }: PageHeaderProps) {
  return (
    <header className="border-b border-[hsl(var(--border))] pb-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className={`text-3xl md:text-4xl font-semibold tracking-tight ${
              titleVariant === "macro" ? "text-[hsl(var(--macro))]" : "text-[hsl(var(--foreground))]"
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</p>
          )}
        </div>
        {actions}
      </div>
    </header>
  );
}
