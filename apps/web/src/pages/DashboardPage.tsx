import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  auditsList,
  auditItemsCountsByAuditIds,
  dashboardStats,
  dashboardWorstDisciplines,
  dashboardErrorsByCategory,
  type AuditListItem,
} from "@/lib/api";
import { CheckCircle2, Package, Calendar, MoreVertical } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
  pausada: "Pausada",
};

export function DashboardPage() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const { data: audits = [] } = useQuery({
    queryKey: ["audits", filterStatus, filterDateFrom, filterDateTo],
    queryFn: () =>
      auditsList({
        status: filterStatus || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      }),
  });

  const auditIds = (audits as AuditListItem[]).map((a) => a.id);
  const { data: countsMap = {} } = useQuery({
    queryKey: ["audit-items-counts", auditIds],
    queryFn: () => auditItemsCountsByAuditIds(auditIds),
    enabled: auditIds.length > 0,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardStats,
  });
  const { data: worstDisciplines = [] } = useQuery({
    queryKey: ["dashboard-worst-disciplines"],
    queryFn: () => dashboardWorstDisciplines(5),
  });
  const { data: errorsByCategory = [] } = useQuery({
    queryKey: ["dashboard-errors-by-category"],
    queryFn: dashboardErrorsByCategory,
  });

  const recent = (audits as AuditListItem[]).slice(0, 20);

  const formatNumber = (n: number) => n.toLocaleString("pt-BR");
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const worstDisciplinesChartData = worstDisciplines.map((d) => ({
    name: d.disciplineName,
    erros: d.errorCount,
  }));
  const errorsByCategoryChartData = errorsByCategory.map((c) => ({
    categoria: c.categoryName,
    Grave: c.major,
    Menor: c.minor,
  }));

  const barColors = {
    dark: "hsl(262 60% 45%)",
    light: "hsl(262 50% 65%)",
  };

  return (
    <Container>
      <div className="space-y-8">
        <PageHeader title="Dashboard" subtitle="Visão geral do sistema" />
        {/* 3 Cards principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Auditorias feitas</p>
                <p className="mt-1 text-3xl font-bold text-[hsl(var(--foreground))] tabular-nums">
                  {stats ? formatNumber(stats.auditsCount) : "—"}
                </p>
                <p className="mt-1 text-sm text-emerald-500">vs mês anterior</p>
              </div>
              <div className="rounded-lg bg-[hsl(262_83%_58%_/_.2)] p-3">
                <CheckCircle2 className="h-8 w-8 text-[hsl(var(--accent))]" />
              </div>
            </div>
            <Link to="/auditorias" className="mt-2 inline-block text-sm font-medium text-[hsl(var(--accent))] hover:opacity-90">
              Ver auditorias
            </Link>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Total de itens no sistema</p>
                <p className="mt-1 text-3xl font-bold text-[hsl(var(--foreground))] tabular-nums">
                  {stats ? formatNumber(stats.totalItems) : "—"}
                </p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Sincronizado com o sistema</p>
              </div>
              <div className="rounded-lg bg-[hsl(262_83%_58%_/_.2)] p-3">
                <Package className="h-8 w-8 text-[hsl(var(--accent))]" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Próxima data de auditoria</p>
                <p className="mt-1 text-3xl font-bold text-[hsl(var(--foreground))] tabular-nums">
                  {stats?.nextAuditDate ? formatDate(stats.nextAuditDate) : "—"}
                </p>
                {stats?.nextAuditSection && (
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Seção: {stats.nextAuditSection}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-amber-500/20 p-3">
                <Calendar className="h-8 w-8 text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Piores disciplinas</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Ranking pelo número total de erros encontrados
                </p>
              </div>
              <button type="button" className="rounded p-1 hover:bg-[hsl(var(--muted))]">
                <MoreVertical className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
            <div className="h-[280px]">
              {worstDisciplinesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
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
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value} erros`, "Erros"]}
                    />
                    <Bar dataKey="erros" radius={[0, 4, 4, 0]} name="Erros">
                      {worstDisciplinesChartData.map((_, i) => (
                        <Cell key={i} fill={barColors.dark} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                  Nenhum dado de erros por disciplina
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Erros por categoria</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Frequência por tipo de não-conformidade
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: barColors.dark }} /> Grave
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: barColors.light }} /> Menor
                </span>
              </div>
            </div>
            <div className="h-[280px]">
              {errorsByCategoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={errorsByCategoryChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={barColors.light} opacity={0.3} />
                    <XAxis
                      dataKey="categoria"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Grave" stackId="a" fill={barColors.dark} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Menor" stackId="a" fill={barColors.light} radius={[0, 0, 0, 0]} />
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
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
          <h2 className="text-lg font-medium text-[hsl(var(--macro))]">Auditorias recentes</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            <div>
              <label htmlFor="filter-status" className="mr-2 text-sm text-[hsl(var(--muted-foreground))]">Status:</label>
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
            <div>
              <label htmlFor="filter-date-from" className="mr-2 text-sm text-[hsl(var(--muted-foreground))]">Data de:</label>
              <input
                id="filter-date-from"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="filter-date-to" className="mr-2 text-sm text-[hsl(var(--muted-foreground))]">Até:</label>
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
                <tr className="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
                  <th className="pb-3 pr-3 font-medium">Auditoria</th>
                  <th className="pb-3 pr-3 font-medium">Auditor</th>
                  <th className="pb-3 pr-3 font-medium">Total</th>
                  <th className="pb-3 pr-3 font-medium">Conforme</th>
                  <th className="pb-3 pr-3 font-medium">Não conforme</th>
                  <th className="pb-3 pr-3 font-medium">Pendente</th>
                  <th className="pb-3 pr-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Data realizada</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => {
                  const counts = countsMap[a.id] ?? { total: 0, conforme: 0, naoConforme: 0, pendente: 0 };
                  return (
                    <tr key={a.id} className="border-b border-[hsl(var(--border))] last:border-0">
                      <td className="py-3 pr-3">
                        <Link to={`/auditorias/${a.id}`} className="font-medium text-[hsl(var(--foreground))] hover:underline">
                          {a.title ?? a.id}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-[hsl(var(--muted-foreground))]">
                        {a.auditor?.name ?? "—"}
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{counts.total}</td>
                      <td className="py-3 pr-3 tabular-nums text-green-600 dark:text-green-500">{counts.conforme}</td>
                      <td className="py-3 pr-3 tabular-nums text-red-600 dark:text-red-400">{counts.naoConforme}</td>
                      <td className="py-3 pr-3 tabular-nums text-amber-600 dark:text-amber-500">{counts.pendente}</td>
                      <td className="py-3 pr-3 text-[hsl(var(--muted-foreground))]">
                        {STATUS_LABELS[a.status] ?? a.status}
                      </td>
                      <td className="py-3 tabular-nums">
                        {a.startDate ? new Date(a.startDate).toLocaleDateString("pt-BR") : "—"}
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
