import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  auditCancel,
  auditComplete,
  auditFinishVerification,
  auditGet,
  auditItems,
  type AuditDetail,
  type AuditItemRow,
} from "@/lib/api";

const statusLabels: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  WAITING_FOR_ISSUES: "Aguardando apontamentos",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

const itemStatusLabels: Record<string, string> = {
  NOT_STARTED: "Não iniciado",
  CONFORMING: "Conforme",
  NONCONFORMING: "Não conforme",
  OBSERVATION: "Observação",
  NA: "N/A",
  RESOLVED: "Resolvido",
  ALWAYS_CONFORMING: "Sempre conforme",
};

function itemDescription(item: AuditItemRow): string {
  return item.checklistItem?.description ?? item.customItem?.description ?? "";
}

function itemDiscipline(item: AuditItemRow): string {
  return item.checklistItem?.category?.discipline?.name ?? item.customItem?.discipline?.name ?? "";
}

export function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: audit, isLoading, error } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => auditGet(id!),
    enabled: !!id,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["audit-items", id],
    queryFn: () => auditItems(id!),
    enabled: !!id,
  });

  const finishVerification = useMutation({
    mutationFn: () => auditFinishVerification(id!),
    onSuccess: (a) => queryClient.setQueryData(["audit", id], a),
  });
  const complete = useMutation({
    mutationFn: () => auditComplete(id!),
    onSuccess: (a) => queryClient.setQueryData(["audit", id], a),
  });
  const cancel = useMutation({
    mutationFn: () => auditCancel(id!),
    onSuccess: (a) => queryClient.setQueryData(["audit", id], a),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (error) return <div className="p-6 text-red-600">{error instanceof Error ? error.message : "Erro ao carregar"}</div>;
  if (!audit) return <div className="p-6">Auditoria não encontrada.</div>;

  const canFinish = (audit as AuditDetail).status === "IN_PROGRESS";
  const canComplete = (audit as AuditDetail).status === "WAITING_FOR_ISSUES";
  const canCancelAudit = (audit as AuditDetail).status === "IN_PROGRESS" || (audit as AuditDetail).status === "WAITING_FOR_ISSUES";

  return (
    <div>
      <Link to="/audits" className="mb-4 inline-block text-sm text-purple-600 hover:underline">← Voltar à lista</Link>
      <div className="mb-6 rounded-lg border border-purple-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-purple-900">{(audit as AuditDetail).title}</h1>
          <span className={`rounded-full px-2 py-0.5 text-sm ${(audit as AuditDetail).status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : (audit as AuditDetail).status === "WAITING_FOR_ISSUES" ? "bg-amber-100 text-amber-800" : (audit as AuditDetail).status === "CANCELED" ? "bg-purple-100 text-purple-600" : "bg-purple-100 text-purple-800"}`}>
            {statusLabels[(audit as AuditDetail).status] ?? (audit as AuditDetail).status}
          </span>
        </div>
        <p className="mt-1 text-sm text-purple-600/90">
          {[(audit as AuditDetail).work?.name, (audit as AuditDetail).phase?.name, (audit as AuditDetail).discipline?.name, (audit as AuditDetail).auditPhase?.label].filter(Boolean).join(" · ")}
          {(audit as AuditDetail).auditor?.name && ` · ${(audit as AuditDetail).auditor.name}`}
        </p>

        {(audit as AuditDetail).status === "WAITING_FOR_ISSUES" && (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
            Aguardando apontamentos: preencha os códigos Construflow nos itens não conformes e depois conclua a auditoria.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canFinish && (
            <button
              onClick={() => finishVerification.mutate()}
              disabled={finishVerification.isPending}
              className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {finishVerification.isPending ? "Processando..." : "Finalizar verificação"}
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => complete.mutate()}
              disabled={complete.isPending}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {complete.isPending ? "Processando..." : "Concluir auditoria"}
            </button>
          )}
          {canCancelAudit && (
            <button
              onClick={() => window.confirm("Cancelar esta auditoria?") && cancel.mutate()}
              disabled={cancel.isPending}
              className="rounded border border-purple-200 bg-white px-4 py-2 text-sm font-medium hover:bg-purple-50 disabled:opacity-50"
            >
              {cancel.isPending ? "Processando..." : "Cancelar auditoria"}
            </button>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-lg font-medium text-purple-900">Itens</h2>
      <ul className="space-y-2">
        {(items as AuditItemRow[]).map((item) => (
          <li key={item.id} className="rounded border border-purple-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-purple-900">{itemDescription(item)}</p>
                <p className="text-xs text-purple-600/90">{itemDiscipline(item)}</p>
              </div>
              <span className="rounded px-2 py-0.5 text-xs text-purple-600/90">
                {itemStatusLabels[item.status] ?? item.status}
              </span>
            </div>
            {item.evidenceText && <p className="mt-1 text-sm text-purple-600/90">{item.evidenceText}</p>}
            {item.construflowRef && <p className="mt-1 text-sm text-purple-600/90">Construflow: {item.construflowRef}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
