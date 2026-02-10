import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { auditGet, type AuditDetail } from "@/lib/api";

export default function RelatoriosPage() {
  const { id } = useParams<{ id: string }>();
  const { data: audit, isError } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => auditGet(id!),
    enabled: !!id,
  });

  if (isError || (id && !audit)) {
    return (
      <Container>
        <p className="text-red-600">Auditoria não encontrada.</p>
        <Link to="/auditorias" className="mt-2 inline-block text-sm text-[hsl(var(--accent))]">← Voltar</Link>
      </Container>
    );
  }

  if (!audit) return null;

  return (
    <Container>
      <div className="mb-6">
        <Link to={`/auditorias/${id}`} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">← Auditoria</Link>
      </div>
      <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Relatórios</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Relatório Parcial (em andamento), Técnico (aguardando apontamentos) ou Final (concluída).</p>
      <div className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Status: {(audit as AuditDetail).status}</p>
        <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Exportação em PDF e Excel será implementada na próxima fase.</p>
      </div>
    </Container>
  );
}
