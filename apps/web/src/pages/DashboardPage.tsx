import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { worksList, auditsList, type AuditListItem } from "@/lib/api";

export function DashboardPage() {
  const { data: works = [] } = useQuery({
    queryKey: ["works"],
    queryFn: worksList,
  });
  const { data: audits = [] } = useQuery({
    queryKey: ["audits"],
    queryFn: () => auditsList({}),
  });
  const recent = (audits as AuditListItem[]).slice(0, 5);

  return (
    <Container>
      <div className="space-y-8">
        <PageHeader title="Dashboard" subtitle="Visão geral do sistema" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Obras</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">{works.length}</p>
            <Link to="/obras" className="mt-2 inline-block text-sm font-medium text-[hsl(var(--accent))] hover:opacity-90">Ver obras</Link>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Auditorias</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">{audits.length}</p>
            <Link to="/auditorias" className="mt-2 inline-block text-sm font-medium text-[hsl(var(--accent))] hover:opacity-90">Ver auditorias</Link>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Templates</p>
            <Link to="/templates" className="mt-2 inline-block text-sm font-medium text-[hsl(var(--accent))] hover:opacity-90">Biblioteca</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
          <h2 className="text-lg font-medium text-[hsl(var(--macro))]">Auditorias recentes</h2>
          <ul className="mt-4 space-y-2">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-2">
                <Link to={`/auditorias/${a.id}`} className="font-medium text-[hsl(var(--foreground))] hover:underline">{a.title ?? a.id}</Link>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{a.status}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria ainda.</li>}
          </ul>
        </div>
      </div>
    </Container>
  );
}
