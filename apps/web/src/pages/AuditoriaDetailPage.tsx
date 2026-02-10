import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { auditGet, auditItems, type AuditDetail, type AuditItemRow } from "@/lib/api";

const statusLabel: Record<string, string> = {
  NOT_STARTED: "Pendente",
  CONFORMING: "Conforme",
  NONCONFORMING: "Não conforme",
  OBSERVATION: "Observação",
  NA: "N/A",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  WAITING_FOR_ISSUES: "Aguardando apontamentos",
  CANCELED: "Cancelada",
};

export function AuditoriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: audit, isError } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => auditGet(id!),
    enabled: !!id,
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["audit-items", id],
    queryFn: () => auditItems(id!),
    enabled: !!id,
  });

  if (isError || (id && !audit)) {
    return (
      <Container>
        <p className="text-red-600">Auditoria não encontrada.</p>
        <Link to="/auditorias" className="mt-2 inline-block text-sm text-blue-600">← Voltar às auditorias</Link>
      </Container>
    );
  }

  if (!audit) return null;

  const ncCount = (itens as AuditItemRow[]).filter((i) => i.status === "NONCONFORMING").length;
  const pendentes = (itens as AuditItemRow[]).filter((i) => i.status === "NOT_STARTED").length;

  return (
    <Container>
      <div className="mb-6">
        <Link to="/auditorias" className="text-sm text-gray-500 hover:text-gray-900">← Auditorias</Link>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">{(audit as AuditDetail).title ?? "Auditoria"}</h1>
        <p className="text-sm text-gray-500">
          {(audit as AuditDetail).work?.name ?? ""} • {(audit as AuditDetail).phase?.name ?? ""} • {(audit as AuditDetail).discipline?.name ?? ""} • {(audit as AuditDetail).auditPhase?.name ?? ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <span className="rounded-full border px-3 py-1 text-xs font-medium">{statusLabel[(audit as AuditDetail).status] ?? (audit as AuditDetail).status}</span>
          <span className="text-sm text-gray-500">{ncCount} NC(s) • {pendentes} pendente(s)</span>
        </div>
        <div className="mt-6 flex gap-3">
          <Link to={`/auditorias/${id}/execucao`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90">Execução</Link>
          <Link to={`/auditorias/${id}/ncs`} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">NCs</Link>
        </div>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Itens</h2>
        <ul className="mt-4 space-y-2">
          {(itens as AuditItemRow[]).slice(0, 20).map((i) => (
            <li key={i.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <p className="font-medium text-gray-900">
                {i.checklistItem?.description ?? i.customItem?.description ?? i.id}
              </p>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${i.status === "CONFORMING" ? "bg-emerald-600 text-white" : i.status === "NONCONFORMING" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                {statusLabel[i.status] ?? i.status}
              </span>
            </li>
          ))}
          {itens.length > 20 && <li className="text-sm text-gray-500">+ {itens.length - 20} itens</li>}
        </ul>
      </div>
    </Container>
  );
}
