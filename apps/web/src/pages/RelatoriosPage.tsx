import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { auditGet, type AuditDetail } from "@/lib/api";

export function RelatoriosPage() {
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
        <Link to="/auditorias" className="mt-2 inline-block text-sm text-blue-600">← Voltar</Link>
      </Container>
    );
  }

  if (!audit) return null;

  return (
    <Container>
      <div className="mb-6">
        <Link to={`/auditorias/${id}`} className="text-sm text-gray-500 hover:text-gray-900">← Auditoria</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>
      <p className="text-sm text-gray-500">Relatório Parcial (em andamento), Técnico (aguardando apontamentos) ou Final (concluída).</p>
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Status: {(audit as AuditDetail).status}</p>
        <p className="mt-4 text-sm text-gray-500">Exportação em PDF e Excel será implementada na próxima fase.</p>
      </div>
    </Container>
  );
}
