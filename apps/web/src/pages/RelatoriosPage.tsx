import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import {
  auditGet,
  auditItemsForReport,
  computeAuditScores,
  type AuditDetail,
  type AuditReportItemRow,
} from "@/lib/api";

const statusLabel: Record<string, string> = {
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
  nao_iniciado: "Não iniciado",
};

/** Tipo de relatório conforme PRD FR-18.1 */
function tipoRelatorio(status: string): "Parcial" | "Técnico (Stand-by)" | "Final" {
  if (status === "em_andamento" || status === "nao_iniciado") return "Parcial";
  if (status === "aguardando_apontamentos") return "Técnico (Stand-by)";
  if (status === "concluida") return "Final";
  return "Parcial";
}

/** Retorna a classe CSS para a cor do score baseado no valor
 * 0% até 60%: vermelho
 * 60,01% até 75%: amarelo
 * acima de 75,01%: verde
 */
export function getScoreColorClass(score: number): string {
  if (score <= 60) {
    return "text-red-600"; // Vermelho: 0% até 60%
  } else if (score <= 75) {
    return "text-yellow-600"; // Amarelo: 60,01% até 75%
  } else {
    return "text-green-600"; // Verde: acima de 75,01%
  }
}

export function RelatoriosPage() {
  const { id } = useParams<{ id: string }>();
  const { data: audit, isError } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => auditGet(id!),
    enabled: !!id,
  });
  const { data: reportItems = [] } = useQuery({
    queryKey: ["audit-report-items", id],
    queryFn: () => auditItemsForReport(id!),
    enabled: !!id,
  });

  if (isError || (id && !audit)) {
    return (
      <Container>
        <p className="text-red-600">Auditoria não encontrada.</p>
        <Link to="/relatorios" className="mt-2 inline-block text-sm text-[hsl(var(--accent))]">← Relatórios</Link>
      </Container>
    );
  }

  if (!audit) return null;

  const detail = audit as AuditDetail;
  const items = reportItems as AuditReportItemRow[];
  const { score, byDiscipline } = computeAuditScores(items);
  const ncs = items.filter((i) => i.status === "NONCONFORMING");

  return (
    <Container>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/relatorios" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          ← Relatórios
        </Link>
        <Link to={`/auditorias/${id}`} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          Ver auditoria
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Relatório da auditoria</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
        {tipoRelatorio(detail.status)} — {statusLabel[detail.status] ?? detail.status}
      </p>

      {/* Identificação (FR-18) */}
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Identificação</h2>
        <ul className="mt-3 space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
          <li><strong className="text-[hsl(var(--foreground))]">Obra:</strong> {detail.work?.name ?? "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Fase:</strong> {detail.phase?.name ?? "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Disciplina:</strong> {detail.discipline?.name ?? "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Data início:</strong> {detail.startDate ? new Date(detail.startDate).toLocaleDateString("pt-BR") : "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Data conclusão:</strong> {detail.endDate ? new Date(detail.endDate).toLocaleDateString("pt-BR") : "—"}</li>
          <li><strong className="text-[hsl(var(--foreground))]">Auditor:</strong> {detail.auditor?.name ?? "—"}</li>
        </ul>
      </div>

      {/* Score geral (FR-18) */}
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
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

      {/* Score por disciplina (FR-15/FR-18) */}
      {byDiscipline.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
          <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Score por disciplina</h2>
          <ul className="mt-4 space-y-3">
            {byDiscipline.map((d) => (
              <li key={d.disciplineId} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-3">
                <span className="font-medium text-[hsl(var(--foreground))]">{d.disciplineName}</span>
                <span className={`text-lg font-semibold ${getScoreColorClass(d.score)}`}>{d.score.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Não conformidades com evidências e Construflow (FR-18) */}
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
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

      <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
        Exportação em PDF e Excel será implementada na próxima fase.
      </p>
    </Container>
  );
}
