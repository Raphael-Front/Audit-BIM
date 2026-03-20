"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { auditGet, auditItems, auditFinishVerification, auditComplete, auditCancel, AUDIT_STATUS_BADGE_CLASS, buildNcsIncompletosMessage, type AuditDetail, type AuditItemRow } from "@/lib/api";
import { EvidenciaLink } from "@/components/evidencias/EvidenciaLink";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import { FileCheck, AlertTriangle, XCircle, Play, FileText, ListChecks, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

const MSG_SEM_PERMISSAO = "Você não tem permissão para acessar esta página.";

const ITEMS_PER_PAGE = 15;

const statusLabel: Record<string, string> = {
  NOT_STARTED: "Pendente",
  CONFORMING: "Conforme",
  NONCONFORMING: "Não conforme",
  OBSERVATION: "Observação",
  NA: "N/A",
  CORRIGIDO: "Corrigido",
  nao_iniciado: "Não iniciado",
  agendado: "Agendado",
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function AuditoriaDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [currentPage, setCurrentPage] = useState(1);
  const isLeitor = me?.role === "leitor";
  const { data: audit, isError, isPending } = useQuery({
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
    onSuccess: (updatedAudit) => {
      queryClient.setQueryData(["audit", id], updatedAudit);
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      toast.success("Auditoria cancelada com sucesso.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar auditoria.");
    },
  });

  if (isPending && !!id) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--accent))]" />
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Carregando auditoria...</p>
        </div>
      </Container>
    );
  }

  if (isError || (id && !audit)) {
    return (
      <Container>
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="font-medium text-red-700 dark:text-red-400">Auditoria não encontrada.</p>
          <Link
            href="/auditorias"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--accent))] hover:underline"
          >
            <NavArrowIcon direction="back" className="h-4 w-4" />
            Voltar às auditorias
          </Link>
        </div>
      </Container>
    );
  }

  if (!audit) return null;

  const status = (audit as AuditDetail).status as string;
  const ncCount = (itens as AuditItemRow[]).filter((i) => i.status === "NONCONFORMING").length;
  const pendentes = (itens as AuditItemRow[]).filter((i) => i.status === "NOT_STARTED").length;
  const ncsIncompletos = (itens as AuditItemRow[]).filter(
    (i) =>
      i.status === "NONCONFORMING" &&
      (!(i.construflowRef && i.construflowRef.trim()) || !(i.evidenceText && i.evidenceText.trim()))
  );
  const podeFinalizar =
    (status === "nao_iniciado" || status === "agendado" || status === "em_andamento") &&
    pendentes === 0 &&
    (itens as AuditItemRow[]).length > 0;
  const podeConcluir = status === "aguardando_apontamentos" && ncsIncompletos.length === 0;
  const podeCancelar =
    status === "nao_iniciado" ||
    status === "agendado" ||
    status === "em_andamento" ||
    status === "aguardando_apontamentos";

  const detailParts = [
    (audit as AuditDetail).work?.name,
    (audit as AuditDetail).discipline?.name,
    (audit as AuditDetail).phase?.name,
    (audit as AuditDetail).auditPhase?.name,
  ].filter(Boolean) as string[];
  const detailText = [...new Set(detailParts)].join(" • ");

  const itemStatusBadge = (itemStatus: string) => {
    if (itemStatus === "CONFORMING") return "bg-[var(--color-success-bg)] text-[var(--color-success)]";
    if (itemStatus === "CORRIGIDO") return "bg-[var(--color-info-bg)] text-[var(--color-info)]";
    if (itemStatus === "NONCONFORMING") return "bg-[var(--color-danger-bg)] text-[var(--color-danger)]";
    return "bg-[var(--color-warning-bg)] text-[var(--color-warning)]";
  };

  return (
    <Container>
      {/* Breadcrumb */}
      <nav className="mb-8" aria-label="Navegação">
        <Link
          href="/auditorias"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          <NavArrowIcon direction="back" className="h-4 w-4" />
          Auditorias
        </Link>
      </nav>

      {/* Card principal */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_4px_rgba(0,0,0,0.05)] border-l-4 border-l-[var(--color-accent)]">
        <div className="border-b border-[var(--color-border)] px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-xl">
                {detailText || "—"}
              </h1>
              <h2 className="mt-1 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                {(audit as AuditDetail).title ?? "Auditoria"}
              </h2>
            </div>
            {status !== "concluida" && (
              <button
                onClick={async () => {
                  if (podeFinalizar) finishVerification.mutate();
                  else if (podeConcluir) {
                    const ok = await confirm({ title: "Concluir auditoria", message: "Concluir esta auditoria?" });
                    if (ok) completeAudit.mutate();
                  }
                }}
                disabled={(!podeFinalizar && !podeConcluir) || finishVerification.isPending || completeAudit.isPending}
                title={
                  pendentes > 0
                    ? "Avalie todos os itens primeiro"
                    : ncsIncompletos.length > 0
                      ? "Preencha Construflow ID e evidência nos itens não conformes"
                      : undefined
                }
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  podeFinalizar || podeConcluir
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow disabled:opacity-50"
                    : "cursor-not-allowed bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                <FileCheck className="h-4 w-4" />
                {finishVerification.isPending || completeAudit.isPending
                  ? "Processando..."
                  : podeFinalizar
                    ? "Finalizar verificação"
                    : "Concluir auditoria"}
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold ${AUDIT_STATUS_BADGE_CLASS[status] ?? "badge-status-nao-iniciado"}`}
            >
              {statusLabel[status] ?? status}
            </span>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {ncCount} NC(s) • {pendentes} pendente(s)
            </span>
          </div>
        </div>

        {status === "aguardando_apontamentos" && ncsIncompletos.length > 0 && (
          <div className="flex items-start gap-3 border-b border-[var(--color-border)] bg-[var(--color-warning-bg)] border-l-[3px] border-l-[var(--color-warning)] px-6 py-4 sm:px-8">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warning)]" />
            <div className="text-sm text-[var(--color-text-primary)]">
              <p className="font-medium">Preencha o Construflow ID e evidência/observações nos seguintes itens e depois clique em Concluir auditoria:</p>
              <p className="mt-2">{buildNcsIncompletosMessage(ncsIncompletos)}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-start gap-2 px-6 py-4 sm:gap-3 sm:px-8">
          {status === "concluida" ? (
            <>
              {isLeitor ? (
                <span
                  onClick={() => toast.error(MSG_SEM_PERMISSAO)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && toast.error(MSG_SEM_PERMISSAO)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--accent-foreground))] transition-all hover:opacity-90"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </span>
              ) : (
                <Link
                  href={`/auditorias/${id}/execucao`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--accent-foreground))] transition-all hover:opacity-90"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Link>
              )}
                <Link
                  href={`/relatorios/${id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
              >
                <FileText className="h-4 w-4" />
                Relatório
              </Link>
              {isLeitor ? (
                <span
                  onClick={() => toast.error(MSG_SEM_PERMISSAO)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && toast.error(MSG_SEM_PERMISSAO)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <AlertTriangle className="h-4 w-4" />
                  NCs
                </span>
              ) : (
                <Link
                  href={`/auditorias/${id}/ncs`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <AlertTriangle className="h-4 w-4" />
                  NCs
                </Link>
              )}
            </>
          ) : (
            <>
              {isLeitor ? (
                <span
                  onClick={() => toast.error(MSG_SEM_PERMISSAO)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && toast.error(MSG_SEM_PERMISSAO)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--accent-foreground))] transition-all hover:opacity-90"
                >
                  <Play className="h-4 w-4" />
                  Execução
                </span>
              ) : (
                <Link
                  href={`/auditorias/${id}/execucao`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--accent-foreground))] transition-all hover:opacity-90"
                >
                  <Play className="h-4 w-4" />
                  Execução
                </Link>
              )}
              {isLeitor ? (
                <span
                  onClick={() => toast.error(MSG_SEM_PERMISSAO)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && toast.error(MSG_SEM_PERMISSAO)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <AlertTriangle className="h-4 w-4" />
                  NCs
                </span>
              ) : (
                <Link
                  href={`/auditorias/${id}/ncs`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <AlertTriangle className="h-4 w-4" />
                  NCs
                </Link>
              )}
            </>
          )}
          {podeCancelar && (
            isLeitor ? (
              <button
                type="button"
                onClick={() => toast.error(MSG_SEM_PERMISSAO)}
                className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
              >
                <XCircle className="h-4 w-4" />
                Cancelar auditoria
              </button>
            ) : (
              <button
                onClick={async () => {
                  const ok = await confirm({ title: "Cancelar auditoria", message: "Cancelar esta auditoria?", variant: "danger" });
                  if (ok) cancelAudit.mutate();
                }}
                disabled={cancelAudit.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {cancelAudit.isPending ? "Processando..." : "Cancelar auditoria"}
              </button>
            )
          )}
        </div>
      </div>

      {/* Seção de itens */}
      <section className="mt-10" aria-labelledby="itens-heading">
        {(() => {
          const allItens = itens as AuditItemRow[];
          const totalPages = Math.ceil(allItens.length / ITEMS_PER_PAGE);
          const safePage = Math.min(currentPage, totalPages || 1);
          const pageItens = allItens.slice(
            (safePage - 1) * ITEMS_PER_PAGE,
            safePage * ITEMS_PER_PAGE
          );

          return (
            <>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2
                  id="itens-heading"
                  className="flex items-center gap-2 text-lg font-semibold text-[hsl(var(--foreground))]"
                >
                  <ListChecks className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                  Itens
                  {allItens.length > 0 && (
                    <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">
                      ({allItens.length})
                    </span>
                  )}
                </h2>
                {totalPages > 1 && (
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Página {safePage} de {totalPages}
                  </span>
                )}
              </div>

              <ul className="space-y-2">
                {pageItens.map((i) => {
                  const desc =
                    i.checklistItem?.description ?? i.customItem?.description ?? i.id;
                  return (
                    <li
                      key={i.id}
                      className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3.5 transition-colors hover:border-[hsl(var(--border))]/80 sm:px-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p
                          className="min-w-0 flex-1 font-medium text-[hsl(var(--foreground))] leading-snug"
                          title={typeof desc === "string" ? desc : String(desc)}
                        >
                          {typeof desc === "string" && desc.length > 120
                            ? desc.slice(0, 120) + "..."
                            : desc}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${itemStatusBadge(i.status)}`}
                        >
                          {statusLabel[i.status] ?? i.status}
                        </span>
                      </div>
                      {i.status === "NONCONFORMING" &&
                        (i.evidenceText || (i.anexos?.length ?? 0) > 0) && (
                          <div className="mt-3 border-t border-[hsl(var(--border))] pt-3 text-sm">
                            {i.evidenceText && (
                              <p className="text-[hsl(var(--muted-foreground))]">{i.evidenceText}</p>
                            )}
                            {(i.anexos?.length ?? 0) > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {i.anexos!.map((a) => (
                                  <EvidenciaLink key={a.id} anexo={a} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <nav
                  className="mt-6 flex flex-wrap items-center justify-center gap-2"
                  aria-label="Navegação entre páginas de itens"
                >
                  <button
                    onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={safePage === 1}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className={`min-w-[2.25rem] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          p === safePage
                            ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                            : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    disabled={safePage === totalPages}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:pointer-events-none disabled:opacity-40"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </nav>
              )}
            </>
          );
        })()}
      </section>
    </Container>
  );
}
