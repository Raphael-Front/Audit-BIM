interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="border-b border-[var(--color-border)] pb-4 mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:flex-wrap">
        <div className="min-w-0">
          <h1
            className="text-[var(--font-size-title2)] font-[var(--font-weight-semibold)] tracking-tight break-words text-[var(--color-text-primary)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-1 text-[var(--font-size-small)] text-[var(--color-text-secondary)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0 ml-auto flex justify-end">{actions}</div>}
      </div>
    </header>
  );
}
