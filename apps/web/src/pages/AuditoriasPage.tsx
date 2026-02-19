import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { api, type AuditListItem } from "@/lib/api";

export function AuditoriasPage() {
  const { data: auditorias = [] } = useQuery({
    queryKey: ["audits"],
    queryFn: () => api<AuditListItem[]>("/audits"),
  });
  const recent = (auditorias as AuditListItem[]).slice(0, 50);

  return (
    <Container>
      <PageHeader
        title="Auditorias"
        subtitle="Planejamento e execução"
        actions={
          <Link
            to="/auditorias/new"
            className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
          >
            Nova auditoria
          </Link>
        }
      />
      <div className="mt-8 space-y-4">
        {recent.map((a) => (
          <Link
            key={a.id}
            to={`/auditorias/${a.id}`}
            className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-4 shadow-sm hover:border-[hsl(var(--accent))]"
          >
            <div>
              <p className="font-medium text-[hsl(var(--foreground))]">{a.title ?? a.id}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{a.startDate ?? "Sem data"}</p>
            </div>
            <span className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{a.status}</span>
          </Link>
        ))}
        {recent.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria.</p>
        )}
      </div>
    </Container>
  );
}
