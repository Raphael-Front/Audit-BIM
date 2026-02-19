import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { auditsList, type AuditListItem } from "@/lib/api";

const statusLabel: Record<string, string> = {
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
  nao_iniciado: "Não iniciado",
  pausada: "Pausada",
};

export function RelatoriosListPage() {
  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: () => auditsList({}),
  });

  return (
    <Container>
      <PageHeader
        title="Relatórios"
        subtitle="Selecione uma auditoria para ver o relatório com score, resumo por disciplina e não conformidades."
        titleVariant="foreground"
      />
      <div className="mt-8 space-y-4">
        {isLoading && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando auditorias…</p>
        )}
        {!isLoading && auditorias.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria para exibir relatório.</p>
        )}
        {!isLoading && auditorias.map((a: AuditListItem) => (
          <Link
            key={a.id}
            to={`/auditorias/${a.id}/relatorios`}
            className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-4 shadow-sm hover:border-[hsl(var(--ring))] transition-colors"
          >
            <div>
              <p className="font-medium text-[hsl(var(--foreground))]">{a.title ?? a.id}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {a.work?.name ?? ""} • {a.phase?.name ?? ""} • {a.startDate ?? "Sem data"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                {statusLabel[a.status] ?? a.status}
              </span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Ver relatório →</span>
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
}
