import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import {
  auditsList,
  worksList,
  worksPhases,
  libraryDisciplines,
  authMe,
  logActivityAsync,
  formatDateLocal,
  workScoreByWorkId,
  type AuditListItem,
  type WorkRow,
  type DisciplineRow,
  type PhaseRow,
} from "@/lib/api";

interface RelatorioGeralModalProps {
  open: boolean;
  onClose: () => void;
}

export function RelatorioGeralModal({ open, onClose }: RelatorioGeralModalProps) {
  const [workId, setWorkId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [disciplineId, setDisciplineId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const filterParams = {
    workId: workId || undefined,
    phaseId: phaseId || undefined,
    disciplineId: disciplineId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data: obras = [] } = useQuery({
    queryKey: ["works"],
    queryFn: () => worksList(),
    enabled: open,
  });

  const { data: disciplinas = [] } = useQuery({
    queryKey: ["disciplines"],
    queryFn: () => libraryDisciplines(),
    enabled: open,
  });

  const { data: fases = [] } = useQuery({
    queryKey: ["phases"],
    queryFn: () => worksPhases(workId || ""),
    enabled: open,
  });

  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["audits", "relatorio", filterParams],
    queryFn: () =>
      Promise.resolve(
        auditsList({
          workId: filterParams.workId,
          phaseId: filterParams.phaseId,
          disciplineId: filterParams.disciplineId,
          dateFrom: filterParams.dateFrom,
          dateTo: filterParams.dateTo,
          excludeStatus: "cancelada",
        })
      ),
    enabled: open,
  });

  const toggleAudit = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    []
  );

  const toggleAll = useCallback(() => {
    if (selectedIds.size === auditorias.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(auditorias.map((a) => a.id)));
    }
  }, [auditorias, selectedIds.size]);

  const getScoreColorRgb = (score: number): [number, number, number] => {
    if (score >= 75) return [22, 163, 74];
    if (score >= 56) return [217, 119, 6];
    return [220, 38, 38];
  };

  const handleGeneratePdf = useCallback(async () => {
    const selected = auditorias.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) {
      setExportError("Selecione pelo menos uma auditoria.");
      return;
    }

    setExportError(null);
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 20;
      const contentWidth = 210 - margin * 2;
      let y = margin;
      const lineHeight = 6;
      const sectionGap = 12;

      const addText = (text: string, fontSize = 10, bold = false, x = margin) => {
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        const lines = pdf.splitTextToSize(text, contentWidth - (x - margin));
        for (const line of lines) {
          if (y > 277) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(line, x, y);
          y += lineHeight;
        }
      };

      const checkNewPage = (needed: number) => {
        if (y + needed > 277) {
          pdf.addPage();
          y = margin;
        }
      };

      // Tipo do relatório: Geral quando todas as auditorias de uma obra; Individual quando só uma; Parcial quando mais de uma mas não todas
      const isAllFromOneWork = !!workId && selected.length === auditorias.length && auditorias.length > 0;
      const reportTitle =
        selected.length === 1
          ? "RELATÓRIO INDIVIDUAL"
          : isAllFromOneWork
            ? "RELATÓRIO GERAL"
            : "RELATÓRIO PARCIAL";

      // Cabeçalho: bloco #0D1B2A
      pdf.setFillColor(13, 27, 42);
      pdf.rect(0, 0, 210, 28, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(reportTitle, margin, 14);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(156, 163, 175);
      pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, margin, 22);
      y = 35;

      // Totais agregados
      const totalConformes = selected.reduce((s, a) => s + (a.conformes ?? 0), 0);
      const totalNaoConformes = selected.reduce((s, a) => s + (a.naoConformes ?? 0), 0);
      const totalPendentes = selected.reduce((s, a) => s + (a.pendentes ?? 0), 0);
      let mediaScore: number;
      if (workId && selected.length > 0) {
        const obraScore = await workScoreByWorkId(workId);
        mediaScore = obraScore != null ? obraScore : selected.reduce((s, a) => s + (a.score ?? 0), 0) / selected.length;
      } else {
        mediaScore =
          selected.length > 0
            ? selected.reduce((s, a) => s + (a.score ?? 0), 0) / selected.length
            : 0;
      }

      // Card de resumo: borda arredondada simulada, fundo #F4F6F9
      checkNewPage(32);
      const resumoY = y;
      pdf.setFillColor(244, 246, 249);
      pdf.roundedRect(margin, resumoY, contentWidth, 30, 2, 2, "F");
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(margin, resumoY, contentWidth, 30, 2, 2, "S");
      y += 4;
      pdf.setTextColor(26, 26, 26);
      addText("Resumo consolidado", 12, true);
      const scoreRgb = getScoreColorRgb(Math.min(100, mediaScore));
      pdf.setTextColor(scoreRgb[0], scoreRgb[1], scoreRgb[2]);
      addText(`Média de Score: ${Math.min(100, mediaScore).toFixed(1)}%`, 11, true);
      pdf.setTextColor(75, 85, 99);
      addText(`Itens Conformes: ${totalConformes}`);
      addText(`Itens Não conformes: ${totalNaoConformes}`);
      addText(`Itens Pendentes: ${totalPendentes}`);
      y += sectionGap;

      // Tabela de auditorias: cabeçalho #0D1B2A
      checkNewPage(40);
      const colW = [50, 28, 20, 28, 20, 24] as const;
      const headers = ["Auditoria", "Obra", "Fase", "Disciplina", "Data", "Score"];
      const startX = margin;
      pdf.setFillColor(13, 27, 42);
      pdf.rect(startX, y, contentWidth, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      let colX = startX + 2;
      for (let c = 0; c < headers.length; c++) {
        pdf.text(headers[c], colX, y + 5.5);
        colX += colW[c];
      }
      y += 8;

      pdf.setFont("helvetica", "normal");
      const rowHeight = 10;
      for (let i = 0; i < selected.length; i++) {
        const a = selected[i];
        checkNewPage(rowHeight + 2);
        const rowBg = i % 2 === 0 ? [255, 255, 255] : [244, 246, 249];
        pdf.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
        pdf.rect(startX, y, contentWidth, rowHeight, "F");
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.1);
        pdf.line(startX, y + rowHeight, startX + contentWidth, y + rowHeight);

        colX = startX + 2;
        pdf.setTextColor(26, 26, 26);
        pdf.setFontSize(8);
        const titulo = (a.title ?? a.id).slice(0, 35);
        pdf.text(titulo, colX, y + 6);
        colX += colW[0];
        pdf.text((a.work?.code ?? a.work?.name ?? "—").slice(0, 18), colX, y + 6);
        colX += colW[1];
        pdf.text((a.phase?.code ?? a.phase?.name ?? "—").slice(0, 12), colX, y + 6);
        colX += colW[2];
        pdf.text((a.discipline?.code ?? a.discipline?.name ?? "—").slice(0, 18), colX, y + 6);
        colX += colW[3];
        pdf.text(formatDateLocal(a.startDate, { day: "2-digit", month: "2-digit", year: "numeric" }), colX, y + 6);
        colX += colW[4];

        const scoreVal = Math.min(100, a.score ?? 0);
        const scoreColor = getScoreColorRgb(scoreVal);
        pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        const barW = 20;
        const barH = 3;
        const barX = colX;
        const barY = y + 3.5;
        pdf.setFillColor(229, 231, 235);
        pdf.rect(barX, barY, barW, barH, "F");
        pdf.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
        pdf.rect(barX, barY, (barW * scoreVal) / 100, barH, "F");
        pdf.setFontSize(8);
        pdf.text(`${scoreVal.toFixed(0)}%`, barX + barW + 2, y + 6);

        y += rowHeight;
      }

      const fileName = `relatorio_geral_${new Date().toISOString().slice(0, 10)}.pdf`;
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
          details: `Exportação PDF relatório geral: ${selected.length} auditoria(s)`,
        });
      } catch {
        /* ignore */
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao gerar PDF.";
      setExportError(msg);
      console.error("Erro ao exportar PDF:", err);
    } finally {
      setIsExporting(false);
    }
  }, [auditorias, selectedIds, workId, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Relatório geral
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Filtros */}
          <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 overflow-hidden sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="min-w-0">
              <label className="mb-0.5 block text-xs font-medium text-[hsl(var(--foreground))]">
                Obras
              </label>
              <select
                value={workId}
                onChange={(e) => {
                  setWorkId(e.target.value);
                  setPhaseId("");
                }}
                className="w-full min-w-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-xs"
              >
                <option value="">Todas</option>
                {(obras as WorkRow[]).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code ?? o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-0.5 block text-xs font-medium text-[hsl(var(--foreground))]">
                Fases
              </label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-xs"
              >
                <option value="">Todas</option>
                {(fases as PhaseRow[]).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code ?? f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-0.5 block text-xs font-medium text-[hsl(var(--foreground))]">
                Disciplina
              </label>
              <select
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-xs"
              >
                <option value="">Todas</option>
                {(disciplinas as DisciplineRow[]).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code ?? d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-0.5">
              <label className="mb-0.5 block text-xs font-medium text-[hsl(var(--foreground))]">
                Período
              </label>
              <div className="flex min-w-0 gap-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-1.5 text-xs"
                  placeholder="De"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-1.5 text-xs"
                  placeholder="Até"
                />
              </div>
              {(dateFrom || dateTo) && (
                <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {dateFrom || "início"} a {dateTo || "hoje"}
                </p>
              )}
            </div>
          </div>

          {/* Lista de auditorias */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                Auditorias filtradas
              </label>
              {auditorias.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-sm text-[hsl(var(--accent))] hover:underline"
                >
                  {selectedIds.size === auditorias.length ? "Desmarcar todas" : "Selecionar todas"}
                </button>
              )}
            </div>

            {isLoading && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando auditorias…</p>
            )}
            {!isLoading && auditorias.length === 0 && (
              <p className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-4 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Nenhuma auditoria encontrada para os filtros selecionados.
              </p>
            )}
            {!isLoading && auditorias.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[hsl(var(--border))] p-2">
                {(auditorias as AuditListItem[]).map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 hover:bg-[hsl(var(--muted))]/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleAudit(a.id)}
                      className="h-4 w-4 rounded border-[hsl(var(--border))]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-[hsl(var(--foreground))]">
                        {a.code ?? a.title ?? a.id}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {a.work?.code ?? a.work?.name ?? ""} • {a.discipline?.code ?? a.discipline?.name ?? ""} •{" "}
                        {formatDateLocal(a.plannedDate ?? a.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                      {Math.min(100, a.score ?? 0).toFixed(1)}%
                    </span>
                  </label>
                ))}
              </div>
            )}

            {exportError && (
              <p className="mt-2 text-sm text-red-600">{exportError}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isExporting || auditorias.length === 0}
            className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isExporting ? "Gerando PDF…" : "Gerar Relatório"}
          </button>
        </div>
      </div>
    </div>
  );
}
