"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { DateRangePicker } from "@/components/DateRangePicker";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import {
  listActivityLogs,
  activityLogsStats,
  listUsers,
  type ActivityLogRow,
  type ActivityLogsStats,
  type UserRow,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criar",
  UPDATE: "Atualizar",
  DELETE: "Excluir",
  VIEW: "Visualizar",
  LOGIN: "Login",
  LOGOUT: "Logout",
  EXPORT: "Exportar",
  ACCESS_DENIED: "Acesso negado",
};

const ENTITY_LABELS: Record<string, string> = {
  AUDITORIA: "Auditoria",
  OBRA: "Obra",
  RELATORIO: "Relatório",
  USUARIO: "Usuário",
  BIBLIOTECA: "Biblioteca",
  CONFIGURACAO: "Configuração",
};

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    CREATE: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    UPDATE: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    DELETE: "bg-red-500/20 text-red-700 dark:text-red-400",
    VIEW: "bg-slate-500/20 text-slate-600 dark:text-slate-400",
    LOGIN: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    LOGOUT: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    ACCESS_DENIED: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    EXPORT: "bg-teal-500/20 text-teal-700 dark:text-teal-400",
  };
  const c = colors[action] ?? "bg-slate-500/20 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function DetailModal({ log, onClose }: { log: ActivityLogRow | null; onClose: () => void }) {
  if (!log) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Detalhes do log</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <span className="font-medium text-[hsl(var(--muted-foreground))]">Data/hora:</span>{" "}
            {new Date(log.created_at).toLocaleString("pt-BR")}
          </div>
          <div>
            <span className="font-medium text-[hsl(var(--muted-foreground))]">Usuário:</span>{" "}
            {log.user_name ?? "—"} ({log.user_email ?? "—"})
          </div>
          <div>
            <span className="font-medium text-[hsl(var(--muted-foreground))]">Ação:</span>{" "}
            <ActionBadge action={log.action} />
          </div>
          <div>
            <span className="font-medium text-[hsl(var(--muted-foreground))]">Entidade:</span>{" "}
            {ENTITY_LABELS[log.entity] ?? log.entity}
          </div>
          <div>
            <span className="font-medium text-[hsl(var(--muted-foreground))]">Descrição:</span>{" "}
            {log.details ?? "—"}
          </div>
          {log.ip && (
            <div>
              <span className="font-medium text-[hsl(var(--muted-foreground))]">IP:</span> {log.ip}
            </div>
          )}
          {log.user_agent && (
            <div>
              <span className="font-medium text-[hsl(var(--muted-foreground))]">User-Agent:</span>{" "}
              <span className="break-all text-xs">{log.user_agent}</span>
            </div>
          )}
          {log.previous_value && Object.keys(log.previous_value).length > 0 && (
            <div>
              <span className="font-medium text-[hsl(var(--muted-foreground))]">Valor anterior:</span>
              <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3 text-xs">
                {JSON.stringify(log.previous_value, null, 2)}
              </pre>
            </div>
          )}
          {log.new_value && Object.keys(log.new_value).length > 0 && (
            <div>
              <span className="font-medium text-[hsl(var(--muted-foreground))]">Novo valor:</span>
              <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3 text-xs">
                {JSON.stringify(log.new_value, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function exportLogsToCsv(logs: ActivityLogRow[]) {
  const headers = ["Data/Hora", "Usuário", "Ação", "Entidade", "Nome do item", "Descrição", "IP"];
  const rows = logs.map((l) => [
    new Date(l.created_at).toLocaleString("pt-BR"),
    l.user_name ?? "",
    ACTION_LABELS[l.action] ?? l.action,
    ENTITY_LABELS[l.entity] ?? l.entity,
    l.entity_name ?? "",
    l.details ?? "",
    l.ip ?? "",
  ]);
  const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ActivityLogsPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === "admin_bim";

  const [search, setSearch] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState<"created_at" | "user_name" | "action" | "entity" | "details">("created_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
  const [selectedLog, setSelectedLog] = useState<ActivityLogRow | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  const PER_PAGE = 50;

  const { data: stats, isLoading: statsLoading } = useQuery<ActivityLogsStats>({
    queryKey: ["activity-logs-stats"],
    queryFn: activityLogsStats,
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "activity-logs",
      search,
      actions,
      entities,
      userId,
      dateRange.from,
      dateRange.to,
      page,
      orderBy,
      orderDir,
    ],
    queryFn: () =>
      listActivityLogs({
        search: search || undefined,
        actions: actions.length ? actions : undefined,
        entities: entities.length ? entities : undefined,
        userId: userId || undefined,
        dateFrom: dateRange.from || undefined,
        dateTo: dateRange.to || undefined,
        page,
        perPage: PER_PAGE,
        orderBy,
        orderDir,
      }),
    enabled: isAdmin,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const clearFilters = () => {
    setSearch("");
    setActions([]);
    setEntities([]);
    setUserId("");
    setDateRange({ from: "", to: "" });
    setPage(1);
  };

  const toggleSort = (col: typeof orderBy) => {
    if (orderBy === col) setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrderBy(col);
      setOrderDir("desc");
    }
  };

  const toggleAction = (a: string) => {
    setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
    setPage(1);
  };

  const toggleEntity = (e: string) => {
    setEntities((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
    setPage(1);
  };

  const handleExportCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      const { logs: exportLogs } = await listActivityLogs({
        search: search || undefined,
        actions: actions.length ? actions : undefined,
        entities: entities.length ? entities : undefined,
        userId: userId || undefined,
        dateFrom: dateRange.from || undefined,
        dateTo: dateRange.to || undefined,
        forExport: true,
        orderBy,
        orderDir,
      });
      exportLogsToCsv(exportLogs);
    } catch (err) {
      console.error("Erro ao exportar CSV:", err);
    } finally {
      setExportingCsv(false);
    }
  }, [search, actions, entities, userId, dateRange.from, dateRange.to, orderBy, orderDir]);

  if (!isAdmin) {
    return (
      <Container>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="font-medium">Acesso negado</p>
          <p className="mt-1 text-sm">Apenas administradores podem visualizar o Log de Atividades.</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-4">
        <Link href="/configuracoes" className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <NavArrowIcon direction="back" className="h-4 w-4" />
          Configurações
        </Link>
      </div>
      <PageHeader
        title="Log de Atividades"
        subtitle="Histórico de ações no sistema (somente administradores)"
      />

      {/* Stats */}
      {statsLoading ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando estatísticas...</p>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Usuário mais ativo (7 dias)</p>
            <p className="text-lg font-semibold text-[hsl(var(--foreground))] truncate">
              {stats?.mostActiveUserLast7Days ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Ações hoje</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">
              {stats?.actionsToday ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Exclusões (30 dias)</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">
              {stats?.deletionsLast30Days ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Logins (24h)</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">
              {stats?.loginsLast24h ?? 0}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Buscar
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Usuário, descrição..."
              className="mt-1 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
              Período
            </label>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                setDateRange(range);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Usuário
            </label>
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              className="mt-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nomeCompleto}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Entidade
            </label>
            <div className="mt-1 flex flex-wrap gap-1">
              {["AUDITORIA", "OBRA", "RELATORIO", "USUARIO", "BIBLIOTECA", "CONFIGURACAO"].map(
                (e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => toggleEntity(e)}
                    className={`rounded px-2 py-1 text-xs ${
                      entities.includes(e)
                        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/80"
                    }`}
                  >
                    {ENTITY_LABELS[e] ?? e}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Ação
            </label>
            <div className="mt-1 flex flex-wrap gap-1">
            {["CREATE", "UPDATE", "DELETE", "VIEW", "LOGIN", "LOGOUT", "EXPORT", "ACCESS_DENIED"].map(
              (a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAction(a)}
                  className={`rounded px-2 py-1 text-xs ${
                    actions.includes(a)
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/80"
                  }`}
                >
                  {ACTION_LABELS[a] ?? a}
                </button>
              )
            )}
          </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-60"
            >
              {exportingCsv ? "Exportando..." : "Exportar CSV"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Carregando logs...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  onClick={() => toggleSort("created_at")}
                >
                  Data/hora {orderBy === "created_at" && (orderDir === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  onClick={() => toggleSort("user_name")}
                >
                  Usuário {orderBy === "user_name" && (orderDir === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  onClick={() => toggleSort("action")}
                >
                  Ação {orderBy === "action" && (orderDir === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  onClick={() => toggleSort("entity")}
                >
                  Entidade {orderBy === "entity" && (orderDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Nome do item
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  onClick={() => toggleSort("details")}
                >
                  Descrição {orderBy === "details" && (orderDir === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="cursor-pointer border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-[hsl(var(--foreground))]">
                    {log.user_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[hsl(var(--foreground))]">
                    {ENTITY_LABELS[log.entity] ?? log.entity}
                  </td>
                  <td className="max-w-[150px] truncate px-4 py-3 text-sm text-[hsl(var(--foreground))]">
                    {log.entity_name ?? "—"}
                  </td>
                  <td className="max-w-[250px] truncate px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {log.details ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && logs.length === 0 && (
          <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Nenhum log encontrado.
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && (logs.length > 0 || total > 0) && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Página {page} de {totalPages} ({total} registros • 50 por página)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </Container>
  );
}
