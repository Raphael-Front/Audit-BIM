"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { DateRangePicker } from "@/components/DateRangePicker";
import {
  auditsList,
  auditItemsCountsByAuditIds,
  dashboardStats,
  dashboardWorstDisciplines,
  dashboardErrorsByCategory,
  dashboardWorksByScore,
  worksList,
  AUDIT_STATUS_BADGE_CLASS,
  getDisplayStatus,
  type AuditListItem,
  type WorkRow,
} from "@/lib/api";
import { CheckCircle2, Package, Calendar, ShieldCheck, Clock } from "lucide-react";

const MIN_AUDITORIAS = 10;

const STATUS_LABELS: Record<string, string> = {
  planejada: "Planejada",
  nao_iniciado: "Não iniciado",
  agendado: "Agendado",
  em_atraso: "Em atraso",
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
  pausada: "Pausada",
};

function DashboardPage() {
  const [workId, setWorkId] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const dashboardFilters = {
    workId: workId || undefined,
    dateFrom: dateRange.from || undefined,
    dateTo: dateRange.to || undefined,
  };

  const { data: obras = [] } = useQuery({
    queryKey: ["works"],
    queryFn: () => worksList(),
  });

  const auditsDateFrom = filterDateFrom || dateRange.from || undefined;
  const auditsDateTo = filterDateTo || dateRange.to || undefined;

  const { data: audits = [] } = useQuery({
    queryKey: ["audits", filterStatus, auditsDateFrom, auditsDateTo, workId],
    queryFn: () =>
      auditsList({
        status: filterStatus || undefined,
        dateFrom: auditsDateFrom,
        dateTo: auditsDateTo,
        workId: workId || undefined,
      }),
  });

  const auditIds = (audits as AuditListItem[]).map((a) => a.id);
  const { data: countsMap = {} } = useQuery({
    queryKey: ["audit-items-counts", auditIds],
    queryFn: () => auditItemsCountsByAuditIds(auditIds),
    enabled: auditIds.length > 0,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", dashboardFilters],
    queryFn: () => dashboardStats(dashboardFilters),
  });
  const { data: worstDisciplines = [] } = useQuery({
    queryKey: ["dashboard-worst-disciplines", dashboardFilters],
    queryFn: () => dashboardWorstDisciplines(5, dashboardFilters),
  });
  const { data: errorsByCategory = [] } = useQuery({
    queryKey: ["dashboard-errors-by-category", dashboardFilters],
    queryFn: () => dashboardErrorsByCategory(dashboardFilters),
  });
  const { data: worksByScoreRaw = [] } = useQuery({
    queryKey: ["dashboard-works-by-score", dashboardFilters],
    queryFn: () => dashboardWorksByScore(dashboardFilters),
  });

  const worksByScore = worksByScoreRaw.filter((o) => o.totalAuditorias >= MIN_AUDITORIAS);
  const pioresObrasData = [...worksByScore]
    .sort((a, b) => b.scoreMedio - a.scoreMedio)
    .slice(0, 6)
    .map((o) => ({
      name: o.workName,
      valorBarra: o.scoreMedio,
      scoreMedio: o.scoreMedio,
    }));
  const obrasCriticasData = [...worksByScore].sort((a, b) => b.scoreMedio - a.scoreMedio);

  const recent = (audits as AuditListItem[]).slice(0, 20);

  const formatNumber = (n: number) => n.toLocaleString("pt-BR");
  const formatDate = (d: string) => {
    const [y, m, day] = d.split(/[-T]/).map(Number);
    const date = new Date(y, (m || 1) - 1, day || 1);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const worstDisciplinesChartData = worstDisciplines.map((d) => ({
    name: d.disciplineName,
    erros: d.errorCount,
  }));
  const errorsByCategoryChartData = errorsByCategory.map((c) => ({
    categoria: c.categoryName,
    erros: c.major + c.minor,
  }));

  /* Taxa de Conformidade Geral = média ponderada dos scores (mesma lógica do Score Médio por obra) */
  const totalAuditorias = worksByScoreRaw.reduce((s, o) => s + o.totalAuditorias, 0);
  const somaPonderada = worksByScoreRaw.reduce((s, o) => s + o.scoreMedio * o.totalAuditorias, 0);
  const taxaConformidadeGeral = totalAuditorias > 0
    ? Math.round(somaPonderada / totalAuditorias)
    : 0;

  /* Dados derivados dos counts para itens pendentes */
  const getCounts = (a: AuditListItem) => {
    const c = countsMap[a.id] ?? { total: 0, conforme: 0, naoConforme: 0, pendente: 0 };
    const hasC = (c.total + c.conforme + c.naoConforme + c.pendente) > 0;
    if (hasC) return c;
    const t = (a.conformes ?? 0) + (a.naoConformes ?? 0) + (a.pendentes ?? 0);
    return t > 0 ? { total: t, conforme: a.conformes ?? 0, naoConforme: a.naoConformes ?? 0, pendente: a.pendentes ?? 0 } : c;
  };
  const auditsForCounts = audits as AuditListItem[];
  const agg = auditsForCounts.reduce(
    (acc, a) => {
      const c = getCounts(a);
      acc.pendente += c.pendente;
      return acc;
    },
    { pendente: 0 }
  );
  const itensPendentes = agg.pendente;

  const getStatusPorScore = (scoreMedio: number) => {
    if (scoreMedio < 50) return { label: "Crítico", className: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]" };
    if (scoreMedio < 75) return { label: "Atenção", className: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]" };
    return { label: "OK", className: "bg-[var(--color-success-bg)] text-[var(--color-success)]" };
  };

  const getTendenciaIcon = (tendencia: "up" | "down" | "stable") => {
    if (tendencia === "up") return "↑";
    if (tendencia === "down") return "↓";
    return "—";
  };

  const barColors = {
    primary: "var(--color-primary)",
    accent: "var(--color-accent)",
    light: "var(--color-border)",
  };

  return (
    <Container>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Visão geral do sistema"
          actions={
            <div className="flex flex-nowrap items-center gap-3">
              <select
                value={workId}
                onChange={(e) => setWorkId(e.target.value)}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 pl-4 pr-10 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              >
                <option value="">Obras</option>
                {(obras as WorkRow[]).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          }
        />
        {/* 5 Cards principais */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-t-4 border-t-[var(--color-primary)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Auditorias feitas</p>
                <p className="mt-0.5 text-[32px] font-bold tabular-nums text-[var(--color-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                  {stats ? formatNumber(stats.auditsCount) : "—"}
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-[var(--color-primary)] opacity-50" />
            </div>
            <Link href="/auditorias" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:opacity-90">
              Ver auditorias <span>→</span>
            </Link>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-t-4 border-t-[var(--color-info)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Total de itens no sistema</p>
                <p className="mt-0.5 text-[32px] font-bold tabular-nums text-[var(--color-info)]" style={{ fontFamily: "var(--font-display)" }}>
                  {stats ? formatNumber(stats.totalItems) : "—"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Sincronizado com o sistema</p>
              </div>
              <Package className="h-5 w-5 text-[var(--color-info)] opacity-50" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-t-4 border-t-[var(--color-warning)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Próxima data de auditoria</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--color-warning)]" style={{ fontFamily: "var(--font-display)" }}>
                  {stats?.nextAuditDate ? formatDate(stats.nextAuditDate) : "—"}
                </p>
                {stats?.nextAuditSection && (
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    Seção: {stats.nextAuditSection}
                  </p>
                )}
              </div>
              <Calendar className="h-5 w-5 text-[var(--color-warning)] opacity-50" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-t-4 border-t-[var(--color-success)]">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Taxa de Conformidade Geral</p>
                <p className="mt-0.5 text-[32px] font-bold tabular-nums text-[var(--color-success)]" style={{ fontFamily: "var(--font-display)" }}>
                  {taxaConformidadeGeral}%
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-success)]"
                    style={{ width: `${taxaConformidadeGeral}%` }}
                  />
                </div>
              </div>
              <ShieldCheck className="h-5 w-5 text-[var(--color-success)] opacity-50 shrink-0 ml-2" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-t-4 border-t-[var(--color-danger)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Itens Pendentes de Resolução</p>
                <p className="mt-0.5 text-[32px] font-bold tabular-nums text-[var(--color-danger)]" style={{ fontFamily: "var(--font-display)" }}>
                  {itensPendentes > 0 ? formatNumber(itensPendentes) : "—"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Aguardando ação</p>
              </div>
              <Clock className="h-5 w-5 text-[var(--color-danger)] opacity-50" />
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="chart-card-animate rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)] flex flex-col min-h-[310px]">
            <div className="mb-3 shrink-0 pb-3 border-b border-[var(--color-border)]">
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Piores disciplinas</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Ranking pelo número total de erros encontrados
              </p>
            </div>
            <div className="min-h-[250px]">
              {worstDisciplinesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={worstDisciplinesChartData} layout="vertical" margin={{ left: 0, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={barColors.light} opacity={0.3} />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [`${value} erros`, "Erros"]}
                    />
                    <defs>
                      <linearGradient id="barGradientWorst" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={barColors.primary} />
                        <stop offset="100%" stopColor={barColors.accent} />
                      </linearGradient>
                    </defs>
                    <Bar
                      dataKey="erros"
                      radius={[0, 4, 4, 0]}
                      name="Erros"
                      fill="url(#barGradientWorst)"
                      animationDuration={1000}
                      animationEasing="ease-out"
                      animationBegin={150}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                  Nenhum dado de erros por disciplina
                </p>
              )}
            </div>
          </div>

          <div className="chart-card-animate rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)] flex flex-col min-h-[310px]">
            <div className="mb-3 shrink-0 pb-3 border-b border-[var(--color-border)]">
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Erros por categoria</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Frequência por tipo de não-conformidade
              </p>
            </div>
            <div className="min-h-[250px]">
              {errorsByCategoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={errorsByCategoryChartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                    barCategoryGap="15%"
                  >
                    <defs>
                      <linearGradient id="barGradientErrors" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor={barColors.primary} />
                        <stop offset="100%" stopColor={barColors.accent} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={barColors.light} opacity={0.3} />
                    <XAxis
                      dataKey="categoria"
                      height={5}
                      tick={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      labelFormatter={(label) => label}
                      formatter={(value: number) => [`${value} erros`, "Total"]}
                    />
                    <Bar
                      dataKey="erros"
                      fill="url(#barGradientErrors)"
                      radius={[4, 4, 0, 0]}
                      animationDuration={1000}
                      animationEasing="ease-out"
                      animationBegin={150}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                  Nenhum dado de erros por categoria
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Ranking de Obras com Mais Erros e Obras Críticas */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="chart-card-animate rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)] flex flex-col min-h-[310px]">
            <div className="mb-3 shrink-0 pb-3 border-b border-[var(--color-border)]">
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Obras por Score Médio</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Obras ordenadas pela maior média de score (mín. 10 auditorias)
              </p>
            </div>
            <div className="min-h-[250px]">
              {pioresObrasData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pioresObrasData} layout="vertical" margin={{ top: 5, right: 70, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={barColors.light} opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number, _name: string, props: { payload?: { scoreMedio?: number } }) => [
                        `${(props.payload?.scoreMedio ?? value).toFixed(1).replace(".", ",")} pts`,
                        "Score médio",
                      ]}
                    />
                    <defs>
                      <linearGradient id="barGradientObras" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={barColors.primary} />
                        <stop offset="100%" stopColor={barColors.accent} />
                      </linearGradient>
                    </defs>
                    <Bar
                      dataKey="valorBarra"
                      radius={[0, 4, 4, 0]}
                      name="Score"
                      fill="url(#barGradientObras)"
                      animationDuration={1000}
                      animationEasing="ease-out"
                      animationBegin={150}
                    >
                      <LabelList
                        dataKey="scoreMedio"
                        position="right"
                        formatter={(v: number) => `${v.toFixed(1).replace(".", ",")} pts`}
                        style={{ fill: "var(--color-text-primary)", fontSize: 12 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                  Nenhuma obra com auditorias suficientes para análise
                </p>
              )}
            </div>
          </div>

          <div className="chart-card-animate rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)] flex flex-col min-h-[310px] overflow-hidden">
            <div className="mb-3 shrink-0 pb-3 border-b border-[var(--color-border)]">
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Resumo de Obras</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Obras ordenadas por score médio (mín. 10 auditorias)
              </p>
            </div>
            <div className="min-h-[250px] overflow-x-auto">
              <table className="w-full min-w-[400px] table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-[var(--color-bg)] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
                    <th className="pb-3 pr-2">Nome da Obra</th>
                    <th className="pb-3 pr-2">Auditorias</th>
                    <th className="pb-3 pr-2">Score Médio</th>
                    <th className="pb-3 pr-2">Tendência</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {obrasCriticasData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                        Nenhuma obra com auditorias suficientes para análise
                      </td>
                    </tr>
                  ) : obrasCriticasData.map((obra) => {
                    const status = getStatusPorScore(obra.scoreMedio);
                    return (
                      <tr key={obra.workId} className="border-b border-[var(--color-border)] last:border-0 h-14 hover:bg-[var(--color-bg)]">
                        <td className="py-2.5 pr-2 font-medium text-[var(--color-text-primary)] truncate" title={obra.workName}>
                          {obra.workName}
                        </td>
                        <td className="py-2.5 pr-2 tabular-nums">{obra.totalAuditorias}</td>
                        <td className="py-2.5 pr-2 tabular-nums">{obra.scoreMedio.toFixed(1).replace(".", ",")} pts</td>
                        <td className="py-2.5 pr-2">
                          <span
                            className={
                              obra.tendencia === "up"
                                ? "text-[var(--color-success)]"
                                : obra.tendencia === "down"
                                  ? "text-[var(--color-danger)]"
                                  : "text-[var(--color-text-muted)]"
                            }
                          >
                            {getTendenciaIcon(obra.tendencia)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className={`inline-block rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
          <h2 className="text-lg font-semibold text-[var(--color-primary)]" style={{ fontFamily: "var(--font-display)" }}>Auditorias recentes</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
              <label htmlFor="filter-status" className="text-sm text-[hsl(var(--muted-foreground))] sm:mr-2">Status:</label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
              <label htmlFor="filter-date-from" className="text-sm text-[hsl(var(--muted-foreground))] sm:mr-2">Data de:</label>
              <input
                id="filter-date-from"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
              <label htmlFor="filter-date-to" className="text-sm text-[hsl(var(--muted-foreground))] sm:mr-2">Até:</label>
              <input
                id="filter-date-to"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
                  <th className="pb-3 pr-3">Auditoria</th>
                  <th className="pb-3 pr-3">Auditor</th>
                  <th className="pb-3 pr-3">Total</th>
                  <th className="pb-3 pr-3">Conforme</th>
                  <th className="pb-3 pr-3">Não conforme</th>
                  <th className="pb-3 pr-3">Pendente</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3">Data realizada</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => {
                  const display = getCounts(a);
                  return (
                    <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0 h-14 hover:bg-[var(--color-bg)]">
                      <td className="py-3 pr-3">
                        <Link href={`/auditorias/${a.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
                          {a.code ?? a.title ?? a.id}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-[var(--color-text-secondary)]">
                        {a.auditor?.name ?? "—"}
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{display.total}</td>
                      <td className="py-3 pr-3 tabular-nums text-[var(--color-success)]">{display.conforme}</td>
                      <td className="py-3 pr-3 tabular-nums text-[var(--color-danger)]">{display.naoConforme}</td>
                      <td className="py-3 pr-3 tabular-nums text-[var(--color-warning)]">{display.pendente}</td>
                      <td className="py-3 pr-3">
                        <span className={`inline-block rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold ${AUDIT_STATUS_BADGE_CLASS[getDisplayStatus(a)] ?? "badge-status-nao-iniciado"}`}>
                          {STATUS_LABELS[getDisplayStatus(a)] ?? getDisplayStatus(a)}
                        </span>
                      </td>
                      <td className="py-3 tabular-nums">
                        {(a.plannedDate ?? a.startDate) ? formatDate(a.plannedDate ?? a.startDate!) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {recent.length === 0 && (
              <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria encontrada.</p>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}

export { DashboardPage };
export default DashboardPage;
