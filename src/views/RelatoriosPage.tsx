"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { Container } from "@/components/layout/Container";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import {
  auditGet,
  auditItemsForReport,
  computeAuditScores,
  authMe,
  logActivityAsync,
  formatDateLocal,
  type AuditDetail,
  type AuditReportItemRow,
} from "@/lib/api";
import { EvidenciaLink } from "@/components/evidencias/EvidenciaLink";

const statusLabel: Record<string, string> = {
  planejada: "Planejada",
  nao_iniciado: "Não iniciado",
  agendado: "Agendado",
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/** Tipo de relatório conforme PRD FR-18.1 */
function tipoRelatorio(status: string): "Parcial" | "Técnico (Stand-by)" | "Final" {
  if (status === "em_andamento" || status === "nao_iniciado" || status === "agendado") return "Parcial";
  if (status === "aguardando_apontamentos") return "Técnico (Stand-by)";
  if (status === "concluida") return "Final";
  return "Parcial";
}

/** Retorna a classe CSS para a cor do score baseado no valor (usa variáveis para ambos os temas)
 * ≥ 75%: verde | 56–74%: amarelo | < 55%: vermelho
 */
export function getScoreColorClass(score: number): string {
  if (score >= 75) return "text-[var(--report-score-green)]";
  if (score >= 56) return "text-[var(--report-score-yellow)]";
  return "text-[var(--report-score-red)]";
}

/** Retorna a variável CSS do score para uso em estilos inline (barra de progresso) */
export function getScoreColorVar(score: number): string {
  if (score >= 75) return "var(--report-score-green)";
  if (score >= 56) return "var(--report-score-yellow)";
  return "var(--report-score-red)";
}

export function RelatoriosPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const reportRef = useRef<HTMLDivElement>(null);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: audit, isError, isPending } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => auditGet(id!),
    enabled: !!id,
  });
  const { data: reportItems = [] } = useQuery({
    queryKey: ["audit-report-items", id],
    queryFn: () => auditItemsForReport(id!),
    enabled: !!id,
  });

  if (isPending && !!id) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--accent))]" />
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Carregando relatório...</p>
        </div>
      </Container>
    );
  }

  if (isError || (id && !audit)) {
    return (
      <Container>
        <p className="text-red-600">Auditoria não encontrada.</p>
        <Link href="/relatorios" className="mt-2 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--accent))]">
        <NavArrowIcon direction="back" className="h-4 w-4" />
        Relatórios
      </Link>
      </Container>
    );
  }

  if (!audit) return null;

  const detail = audit as AuditDetail;
  if (detail.status === "cancelada") {
    return (
      <Container>
        <p className="text-red-600">Relatório não disponível para auditorias canceladas.</p>
        <Link href="/relatorios" className="mt-2 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--accent))]">
          <NavArrowIcon direction="back" className="h-4 w-4" />
          Voltar aos relatórios
        </Link>
      </Container>
    );
  }

  const items = reportItems as AuditReportItemRow[];
  const { score } = computeAuditScores(items);
  const ncs = items.filter((i) => i.status === "NONCONFORMING");

  const handleExportPdf = async () => {
    const source = pdfTemplateRef.current ?? reportRef.current;
    if (!source) {
      setExportError("Erro: conteúdo do relatório não disponível.");
      return;
    }
    setExportError(null);
    setIsExporting(true);
    try {
      const a4WidthMm = 210;
      const a4HeightMm = 297;
      const margin = 20;
      const contentWidth = a4WidthMm - margin * 2;
      const contentHeight = a4HeightMm - margin * 2;
      const sectionSpacing = 12;
      const captureWidthPx = 794;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let currentY = margin;

      const sections = source.querySelectorAll<HTMLElement>("[data-pdf-section]");

      const h2cOpts = {
        scale: 2,
        width: captureWidthPx,
        windowWidth: captureWidthPx,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
      };

      for (const section of sections) {
        const canvas = await html2canvas(section, h2cOpts);
        const sectionHeightMm = (canvas.height * contentWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/png");

        if (sectionHeightMm <= contentHeight) {
          if (currentY + sectionHeightMm > contentHeight + margin) {
            pdf.addPage();
            currentY = margin;
          }
          pdf.addImage(imgData, "PNG", margin, currentY, contentWidth, sectionHeightMm);
          currentY += sectionHeightMm + sectionSpacing;
        } else {
          if (currentY > margin) {
            pdf.addPage();
            currentY = margin;
          }
          let yOffset = 0;
          let remaining = sectionHeightMm;
          while (remaining > 0) {
            const spaceOnPage = contentHeight + margin - currentY;
            const segmentHeight = Math.min(remaining, spaceOnPage);
            pdf.addImage(imgData, "PNG", margin, currentY - yOffset, contentWidth, sectionHeightMm);
            currentY += segmentHeight;
            yOffset += segmentHeight;
            remaining -= segmentHeight;
            if (remaining > 0) {
              pdf.addPage();
              currentY = margin;
            }
          }
          currentY += sectionSpacing;
        }
      }
      const obra = (detail.work?.name ?? "auditoria").replace(/[^a-z0-9]/gi, "_");
      const fileName = `relatorio_${obra}_${detail.id}.pdf`;
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      try {
        const me = await authMe();
        logActivityAsync({
          userId: me.id,
          userName: me.name,
          userEmail: me.email,
          userRole: me.role,
          action: "EXPORT",
          entity: "RELATORIO",
          entityId: id,
          entityName: detail.title,
          details: `Exportação PDF do relatório da auditoria: ${detail.title}`,
        });
      } catch {
        /* ignore */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PDF. Verifique se o bloqueador de pop-ups permite downloads.";
      setExportError(msg);
      console.error("Erro ao exportar PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Container>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/relatorios" className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <NavArrowIcon direction="back" className="h-4 w-4" />
          Relatórios
        </Link>
        <Link href={`/auditorias/${id}`} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          Ver auditoria
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Relatório da auditoria</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {tipoRelatorio(detail.status)} — {statusLabel[detail.status] ?? detail.status}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={isExporting}
          className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50"
        >
          {isExporting ? "Exportando…" : "Exportar PDF"}
        </button>
      </div>
      {exportError && (
        <p className="mt-2 text-sm text-red-600">{exportError}</p>
      )}

      {/* Conteúdo visível na página - layout original simples */}
      <div ref={reportRef} className="mt-6 w-full min-w-0 overflow-visible">
      <div data-pdf-section className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Identificação</h2>
        <ul className="mt-3 space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
          <li><strong className="text-[hsl(var(--foreground))]">Obra:</strong> {detail.work?.code ?? detail.work?.name ?? "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Fase:</strong> {detail.phase?.code ?? detail.phase?.name ?? "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Disciplina:</strong> {detail.discipline?.code ?? detail.discipline?.name ?? "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Data início:</strong> {formatDateLocal(detail.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Data conclusão:</strong> {formatDateLocal(detail.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Auditor:</strong> {detail.auditor?.name ?? "—"}</li>
        </ul>
      </div>

      <div data-pdf-section className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Score final</h2>
        <div className="mt-4 flex flex-wrap items-baseline gap-6">
          <div>
            <span className={`text-4xl font-bold ${getScoreColorClass(score.scoreGeral)}`}>{score.scoreGeral.toFixed(1)}</span>
            <span className="ml-1 text-lg text-[hsl(var(--muted-foreground))]">%</span>
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            {score.pontosObtidos} / {score.pontosPossiveis} pontos • {score.totalAplicavel} itens aplicáveis
            {score.totalNA > 0 && ` • ${score.totalNA} N/A`}
          </div>
        </div>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Conforme: {score.totalConforme} • Não conforme: {score.totalNaoConforme}
        </p>
      </div>

      <div data-pdf-section className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Não conformidades</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Lista de itens não conformes com evidências e rastreio Construflow.
        </p>
        {ncs.length === 0 ? (
          <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Nenhuma não conformidade.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {ncs.map((i) => (
              <li key={i.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                <p className="font-medium text-[hsl(var(--foreground))]">
                  {i.checklistItem?.description ?? i.customItem?.description ?? i.id}
                </p>
                {i.evidenceText && (
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <strong>Evidência/observação:</strong> {i.evidenceText}
                  </p>
                )}
                {(i.anexos?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <strong className="text-sm text-[hsl(var(--muted-foreground))]">Fotos anexadas: </strong>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {i.anexos!.map((a) => (
                        <EvidenciaLink key={a.id} anexo={a} />
                      ))}
                    </div>
                  </div>
                )}
                {i.construflowRef && (
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <strong>Construflow:</strong> {i.construflowRef}
                  </p>
                )}
                {i.nextReviewAt && (
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <strong>Próxima revisão:</strong> {String(i.nextReviewAt).slice(0, 10)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>

      {/* Template oculto para PDF - visual aprimorado, capturado apenas na exportação */}
      <div ref={pdfTemplateRef} className="fixed -left-[9999px] top-0 w-[794px] bg-[var(--report-bg)]" aria-hidden="true">
      <div data-pdf-section className="rounded-t-2xl bg-[var(--report-header-bg)] px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--report-header-text)]">{detail.work?.code ?? detail.work?.name ?? "—"}</h1>
            <p className="mt-1 text-sm text-[var(--report-header-muted)]">
              {detail.id} • {detail.discipline?.code ?? detail.discipline?.name ?? "—"} • {detail.phase?.code ?? detail.phase?.name ?? "—"}
            </p>
          </div>
          <p className="text-sm text-[var(--report-header-muted)] whitespace-nowrap">
            Gerado em {new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <div data-pdf-section className="mt-6 rounded-2xl border border-[var(--report-border)] bg-[var(--report-card-bg)] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[var(--report-text-primary)]">Identificação</h2>
        <ul className="mt-3 space-y-1 text-sm text-[var(--report-text-secondary)]">
          <li><strong className="text-[var(--report-text-primary)]">Obra:</strong> {detail.work?.code ?? detail.work?.name ?? "—"}</li>
          <li><strong className="text-[var(--report-text-primary)]">Fase:</strong> {detail.phase?.code ?? detail.phase?.name ?? "—"}</li>
          <li><strong className="text-[var(--report-text-primary)]">Disciplina:</strong> {detail.discipline?.code ?? detail.discipline?.name ?? "—"}</li>
          <li><strong className="text-[var(--report-text-primary)]">Data início:</strong> {formatDateLocal(detail.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</li>
          <li><strong className="text-[var(--report-text-primary)]">Data conclusão:</strong> {formatDateLocal(detail.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</li>
          <li><strong className="text-[var(--report-text-primary)]">Auditor:</strong> {detail.auditor?.name ?? "—"}</li>
        </ul>
      </div>

      <div data-pdf-section className="mt-6 rounded-2xl border border-[var(--report-border)] bg-[var(--report-card-bg)] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[var(--report-text-primary)]">Score final</h2>
        <div className="mt-4 flex flex-wrap items-baseline gap-6">
          <div>
            <span className={`text-4xl font-bold ${getScoreColorClass(score.scoreGeral)}`}>{score.scoreGeral.toFixed(1)}</span>
            <span className="ml-1 text-lg text-[var(--report-text-secondary)]">%</span>
          </div>
          <div className="text-sm text-[var(--report-text-secondary)]">
            {score.pontosObtidos} / {score.pontosPossiveis} pontos • {score.totalAplicavel} itens aplicáveis
            {score.totalNA > 0 && ` • ${score.totalNA} N/A`}
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="h-[8px] w-full rounded-full bg-[var(--report-progress-bg)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, score.scoreGeral)}%`, backgroundColor: getScoreColorVar(score.scoreGeral) }}
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-[var(--report-text-secondary)]">
          Conforme: {score.totalConforme} • Não conforme: {score.totalNaoConforme}
        </p>
      </div>

      <div data-pdf-section className="mt-6 rounded-2xl border border-[var(--report-border)] bg-[var(--report-card-bg)] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[var(--report-text-primary)]">Não conformidades</h2>
        <p className="text-sm text-[var(--report-text-secondary)] mt-1">
          Lista de itens não conformes com evidências e rastreio Construflow.
        </p>
        {ncs.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--report-text-secondary)]">Nenhuma não conformidade.</p>
        ) : (
          <ul className="mt-4 space-y-0">
            {ncs.map((i, idx) => (
              <li
                key={i.id}
                className={`flex items-start gap-3 border-b border-[var(--report-border)] p-4 last:border-b-0 ${idx % 2 === 0 ? "bg-[var(--report-bg)]" : "bg-[var(--report-alt-row-bg)]"}`}
              >
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-[var(--report-badge-nc-bg)] text-[var(--report-badge-nc-text)]">
                  Não Conforme
                </span>
                <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--report-text-primary)]">
                  {i.checklistItem?.description ?? i.customItem?.description ?? i.id}
                </p>
                {i.evidenceText && (
                  <p className="mt-2 text-sm text-[var(--report-text-secondary)]">
                    <strong>Evidência/observação:</strong> {i.evidenceText}
                  </p>
                )}
                {(i.anexos?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <strong className="text-sm text-[var(--report-text-secondary)]">Fotos anexadas: </strong>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {i.anexos!.map((a) => (
                        <EvidenciaLink key={a.id} anexo={a} />
                      ))}
                    </div>
                  </div>
                )}
                {i.construflowRef && (
                  <p className="mt-1 text-sm text-[var(--report-text-secondary)]">
                    <strong>Construflow:</strong> {i.construflowRef}
                  </p>
                )}
                {i.nextReviewAt && (
                  <p className="mt-1 text-sm text-[var(--report-text-secondary)]">
                    <strong>Próxima revisão:</strong> {String(i.nextReviewAt).slice(0, 10)}
                  </p>
                )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </Container>
  );
}
