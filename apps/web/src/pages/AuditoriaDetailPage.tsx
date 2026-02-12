import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { auditGet, auditItems, auditFinishVerification, auditComplete, auditCancel, type AuditDetail, type AuditItemRow } from "@/lib/api";

const statusLabel: Record<string, string> = {
  NOT_STARTED: "Pendente",
  CONFORMING: "Conforme",
  NONCONFORMING: "Não conforme",
  OBSERVATION: "Observação",
  NA: "N/A",
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function AuditoriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
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

  const finishVerification = useMutation({
    mutationFn: () => auditFinishVerification(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit", id] }),
  });
  const completeAudit = useMutation({
    mutationFn: () => auditComplete(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit", id] }),
  });
  const cancelAudit = useMutation({
    mutationFn: () => auditCancel(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit", id] }),
  });

  if (isError || (id && !audit)) {
    return (
      <Container>
        <p className="text-red-600">Auditoria não encontrada.</p>
        <Link to="/auditorias" className="mt-2 inline-block text-sm text-[hsl(var(--accent))]">← Voltar às auditorias</Link>
      </Container>
    );
  }

  if (!audit) return null;

  const status = (audit as AuditDetail).status as string;
  const ncCount = (itens as AuditItemRow[]).filter((i) => i.status === "NONCONFORMING").length;
  const pendentes = (itens as AuditItemRow[]).filter((i) => i.status === "NOT_STARTED").length;
  const ncsIncompletos = (itens as AuditItemRow[]).filter(
    (i) => i.status === "NONCONFORMING" && (!(i.construflowRef && i.construflowRef.trim()) || !(i.evidenceText && i.evidenceText.trim()))
  );
  const podeFinalizar = (status === "nao_iniciado" || status === "em_andamento") && pendentes === 0 && (itens as AuditItemRow[]).length > 0;
  const podeConcluir = status === "aguardando_apontamentos" && ncsIncompletos.length === 0;
  const podeCancelar = status === "nao_iniciado" || status === "em_andamento" || status === "aguardando_apontamentos";

  return (
    <Container>
      <div className="mb-6">
        <Link to="/auditorias" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">← Auditorias</Link>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[hsl(var(--macro))]">{(audit as AuditDetail).title ?? "Auditoria"}</h1>
        <p className="text-sm text-[hsl(var(--accent))]/90">
          {(audit as AuditDetail).work?.name ?? ""} • {(audit as AuditDetail).phase?.name ?? ""} • {(audit as AuditDetail).discipline?.name ?? ""} • {(audit as AuditDetail).auditPhase?.name ?? ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="rounded-full border px-3 py-1 text-xs font-medium">{statusLabel[status] ?? status}</span>
          <span className="text-sm text-[hsl(var(--accent))]/90">{ncCount} NC(s) • {pendentes} pendente(s)</span>
          <button
            onClick={() => {
              if (podeFinalizar) finishVerification.mutate();
              else if (podeConcluir && window.confirm("Concluir esta auditoria?")) completeAudit.mutate();
            }}
            disabled={(!podeFinalizar && !podeConcluir) || finishVerification.isPending || completeAudit.isPending}
            title={
              pendentes > 0
                ? "Avalie todos os itens primeiro"
                : ncsIncompletos.length > 0
                  ? "Preencha Construflow ID e evidência nos itens não conformes"
                  : status === "concluida"
                    ? "Auditoria já concluída"
                    : undefined
            }
            className={`ml-auto rounded-xl px-4 py-2 text-sm font-medium ${
              podeFinalizar || podeConcluir
                ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                : "cursor-not-allowed bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            {finishVerification.isPending || completeAudit.isPending
              ? "Processando..."
              : podeFinalizar
                ? "Finalizar verificação"
                : "Concluir auditoria"}
          </button>
        </div>

        {status === "aguardando_apontamentos" && ncsIncompletos.length > 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Preencha o Construflow ID e evidência/observações em cada item não conforme para poder concluir a auditoria.
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Link to={`/auditorias/${id}/execucao`} className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-white hover:opacity-90">Execução</Link>
          <Link to={`/auditorias/${id}/ncs`} className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]">NCs</Link>
          {podeCancelar && (
            <button
              onClick={() => window.confirm("Cancelar esta auditoria?") && cancelAudit.mutate()}
              disabled={cancelAudit.isPending}
              className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50"
            >
              {cancelAudit.isPending ? "Processando..." : "Cancelar auditoria"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[hsl(var(--macro))]">Itens</h2>
        <ul className="mt-4 space-y-2">
          {(itens as AuditItemRow[]).slice(0, 20).map((i) => (
            <li key={i.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-3">
              <p className="font-medium text-[hsl(var(--foreground))]">
                {i.checklistItem?.description ?? i.customItem?.description ?? i.id}
              </p>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${i.status === "CONFORMING" ? "bg-emerald-600 text-white" : i.status === "NONCONFORMING" ? "bg-red-600 text-white" : "bg-[hsl(var(--muted))] text-[hsl(var(--macro))]"}`}>
                {statusLabel[i.status] ?? i.status}
              </span>
            </li>
          ))}
          {itens.length > 20 && <li className="text-sm text-[hsl(var(--accent))]/90">+ {itens.length - 20} itens</li>}
        </ul>
      </div>
    </Container>
  );
}
