"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  api,
  getPermissionsConfig,
  worksList,
  libraryAuditPhases,
  AUDIT_STATUS_LABELS,
  AUDIT_STATUS_BADGE_CLASS,
  getDisplayStatus,
  formatDateLocal,
  type AuditListItem,
  type WorkRow,
  type AuditPhaseRow,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getScoreColorClass } from "@/views/RelatoriosPage";

const PER_PAGE = 10;

/** Ordem de status desc (seta ↓): Concluídas primeiro */
const STATUS_SORT_ORDER_DESC: Record<string, number> = {
  concluida: 0,
  aguardando_apontamentos: 1,
  em_andamento: 2,
  pausada: 3,
  em_atraso: 4,
  agendado: 5,
  planejada: 6,
  cancelada: 7,
  nao_iniciado: 8,
};

/** Ordem de status asc (seta ↑): Em atraso e Agendadas primeiro */
const STATUS_SORT_ORDER_ASC: Record<string, number> = {
  em_atraso: 0,
  aguardando_apontamentos: 1,
  agendado: 2,
  concluida: 3,
  em_andamento: 4,
  pausada: 5,
  planejada: 6,
  cancelada: 7,
  nao_iniciado: 8,
};

/** Prioridade para ordenação padrão: próximas auditorias a serem feitas primeiro */
const STATUS_PRIORITY_NEXT_AUDITS: Record<string, number> = {
  em_atraso: 0,
  agendado: 1,
  nao_iniciado: 2,
  planejada: 2,
  em_andamento: 3,
  pausada: 3,
  aguardando_apontamentos: 4,
  concluida: 5,
  cancelada: 6,
};

function getDisplayCode(a: AuditListItem): string {
  const w = a.work?.code?.trim();
  const d = a.discipline?.code?.trim();
  const p = a.phase?.code ?? a.auditPhase?.label;
  if (w && d && p) return `${w}-${d}-${p}`;
  return a.code ?? a.title ?? a.id;
}

type SortColumn = "score" | "conformes" | "naoConformes" | "pendentes" | "status" | "plannedDate" | "createdDate" | null;
type SortDirection = "asc" | "desc";

function SortArrowIcon({ active, direction }: { active: boolean; direction: SortDirection | null }) {
  const rotation = direction === "desc" ? 180 : 0;
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-[transform,opacity] duration-150 ease-[ease] ${
        active ? "opacity-100" : "opacity-[0.25] group-hover:opacity-30"
      }`}
      style={{ transform: `rotate(${rotation}deg)` }}
      aria-hidden
    >
      <path d="M5 8V2M5 2L2 5M5 2L8 5" />
    </svg>
  );
}

export function AuditoriasPage() {
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams?.get("page") ?? "1", 10));
  const [workId, setWorkId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    const statusFromUrl = searchParams?.get("status") ?? "";
    if (statusFromUrl) setStatusFilter(statusFromUrl);
  }, [searchParams]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const { data: obras = [] } = useQuery({
    queryKey: ["works"],
    queryFn: () => worksList(),
  });
  const { data: fases = [] } = useQuery({
    queryKey: ["library-audit-phases"],
    queryFn: () => libraryAuditPhases(),
  });

  const queryParams = new URLSearchParams();
  if (workId) queryParams.set("workId", workId);
  if (phaseId) queryParams.set("phaseId", phaseId);
  if (statusFilter) queryParams.set("status", statusFilter);
  const queryString = queryParams.toString();
  const auditsPath = queryString ? `/audits?${queryString}` : "/audits";

  const { data: auditorias = [] } = useQuery({
    queryKey: ["audits", workId, phaseId, statusFilter],
    queryFn: () => api<AuditListItem[]>(auditsPath),
  });
  const { me } = useAuth();

  const all = [...(auditorias as AuditListItem[])].sort((a, b) => {
    const mult = sortDirection === "desc" ? -1 : 1;
    let cmp = 0;

    if (sortColumn) {
      switch (sortColumn) {
        case "score": {
          const sa = a.score ?? -1;
          const sb = b.score ?? -1;
          cmp = mult * (sa - sb);
          break;
        }
        case "conformes": {
          const ca = a.conformes ?? 0;
          const cb = b.conformes ?? 0;
          cmp = mult * (ca - cb);
          break;
        }
        case "naoConformes": {
          const na = a.naoConformes ?? 0;
          const nb = b.naoConformes ?? 0;
          cmp = mult * (na - nb);
          break;
        }
        case "pendentes": {
          const pa = a.pendentes ?? 0;
          const pb = b.pendentes ?? 0;
          cmp = mult * (pa - pb);
          break;
        }
        case "status": {
          const order = sortDirection === "desc" ? STATUS_SORT_ORDER_DESC : STATUS_SORT_ORDER_ASC;
          const oa = order[getDisplayStatus(a)] ?? 99;
          const ob = order[getDisplayStatus(b)] ?? 99;
          cmp = oa - ob;
          break;
        }
        case "plannedDate": {
          const da = a.plannedDate ?? a.startDate ?? "";
          const db = b.plannedDate ?? b.startDate ?? "";
          cmp = mult * da.localeCompare(db);
          break;
        }
        case "createdDate": {
          const ca = a.createdDate ?? "";
          const cb = b.createdDate ?? "";
          cmp = mult * ca.localeCompare(cb);
          break;
        }
      }
    } else {
      // Padrão: próximas auditorias primeiro (status prioritário + data planejada ascendente)
      const oa = STATUS_PRIORITY_NEXT_AUDITS[getDisplayStatus(a)] ?? 99;
      const ob = STATUS_PRIORITY_NEXT_AUDITS[getDisplayStatus(b)] ?? 99;
      cmp = oa - ob;
      if (cmp === 0) {
        const da = a.plannedDate ?? a.startDate ?? "";
        const db = b.plannedDate ?? b.startDate ?? "";
        cmp = da.localeCompare(db);
      }
    }
    return cmp !== 0 ? cmp : (a.id ?? "").localeCompare(b.id ?? "");
  });

  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * PER_PAGE;
  const recent = all.slice(start, start + PER_PAGE);

  const canCreate =
    me &&
    (getPermissionsConfig()[me.role as keyof ReturnType<typeof getPermissionsConfig>]?.permissions ?? []).includes(
      "auditorias_new"
    );

  return (
    <Container>
      <PageHeader
        title="Auditorias"
        subtitle="Planejamento e execução"
        actions={
          <div className="flex flex-nowrap items-center gap-3">
            <select
              value={workId}
              onChange={(e) => setWorkId(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 pl-4 pr-10 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-[3px] focus:ring-[var(--color-accent-soft)]"
            >
              <option value="">Obras</option>
              {(obras as WorkRow[]).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 pl-4 pr-10 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-[3px] focus:ring-[var(--color-accent-soft)]"
            >
              <option value="">Fases</option>
              {(fases as AuditPhaseRow[])
                .filter((f) => (f.label || f.name).toLowerCase() !== "geral")
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || f.name}
                  </option>
                ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 pl-4 pr-10 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-[3px] focus:ring-[var(--color-accent-soft)]"
            >
              <option value="">Status</option>
              {Object.entries(AUDIT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {canCreate && (
              <>
                <Link
                  href="/auditorias/new"
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-all duration-150"
                >
                  <span className="text-lg leading-none">+</span>
                  Nova auditoria
                </Link>
                <Link
                  href="/auditorias/new?schedule=1"
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-primary)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all duration-150"
                >
                  Agendar auditoria
                </Link>
              </>
            )}
          </div>
        }
      />
      {/* Mobile: cards empilhados */}
      <div className="mt-8 md:hidden space-y-2">
        {recent.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria.</p>
        ) : (
          recent.map((a) => (
            <Link
              key={a.id}
              href={`/auditorias/${a.id}`}
              className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[var(--color-accent)] transition-all duration-150"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-text-primary)] truncate">{getDisplayCode(a)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Planejada: {formatDateLocal(a.plannedDate ?? a.startDate, { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")} · Criada: {formatDateLocal(a.createdDate, { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.score != null ? (
                      <span className={`font-semibold tabular-nums ${getScoreColorClass(Math.min(100, a.score))}`}>{Math.min(100, a.score)}%</span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                    <span className={`rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${AUDIT_STATUS_BADGE_CLASS[getDisplayStatus(a)] ?? "badge-status-nao-iniciado"}`}>
                      {AUDIT_STATUS_LABELS[getDisplayStatus(a)] ?? getDisplayStatus(a)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pt-1 border-t border-[hsl(var(--border))]/50">
                  <span className="tabular-nums text-[var(--color-success)]"><span className="text-[var(--color-text-secondary)]">Conforme:</span> {a.conformes ?? 0}</span>
                  <span className="tabular-nums text-[var(--color-danger)]"><span className="text-[var(--color-text-secondary)]">Não conf.:</span> {a.naoConformes ?? 0}</span>
                  <span className="tabular-nums text-[var(--color-text-muted)]"><span className="text-[var(--color-text-secondary)]">Pendente:</span> {a.pendentes ?? 0}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      {/* Desktop: tabela com scroll horizontal se necessário */}
      <div className="hidden md:block mt-8 overflow-x-auto">
        <div className="min-w-[700px] space-y-2">
          <div className="grid items-center gap-4 rounded-2xl border border-transparent px-4 lg:px-6 py-1 [grid-template-columns:1fr_8rem_8rem_3.5rem_4.5rem_4.5rem_4.5rem_5.5rem]">
            <span className="min-w-0 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">cod. auditoria</span>
            <button
              type="button"
              role="columnheader"
              aria-sort={sortColumn === "plannedDate" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => handleSort("plannedDate")}
              className="group flex cursor-pointer items-center justify-center gap-1 py-1 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--muted-foreground))]/50 transition-opacity duration-150 ease-[ease] hover:decoration-[hsl(var(--foreground))]"
              style={{ opacity: sortColumn === "plannedDate" ? 1 : 0.7 }}
            >
              Data planejada <SortArrowIcon active={sortColumn === "plannedDate"} direction={sortColumn === "plannedDate" ? sortDirection : null} />
            </button>
            <button
              type="button"
              role="columnheader"
              aria-sort={sortColumn === "createdDate" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => handleSort("createdDate")}
              className="group flex cursor-pointer items-center justify-center gap-1 py-1 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--muted-foreground))]/50 transition-opacity duration-150 ease-[ease] hover:decoration-[hsl(var(--foreground))]"
              style={{ opacity: sortColumn === "createdDate" ? 1 : 0.7 }}
            >
              Data de criação <SortArrowIcon active={sortColumn === "createdDate"} direction={sortColumn === "createdDate" ? sortDirection : null} />
            </button>
            <button
              type="button"
              role="columnheader"
              aria-sort={sortColumn === "score" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => handleSort("score")}
              className="group flex cursor-pointer items-center justify-end gap-1 py-1 pr-1 text-right text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--muted-foreground))]/50 transition-opacity duration-150 ease-[ease] hover:decoration-[hsl(var(--foreground))]"
              style={{ opacity: sortColumn === "score" ? 1 : 0.7 }}
            >
              Score <SortArrowIcon active={sortColumn === "score"} direction={sortColumn === "score" ? sortDirection : null} />
            </button>
            <button
              type="button"
              role="columnheader"
              aria-sort={sortColumn === "conformes" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => handleSort("conformes")}
              className="group flex cursor-pointer items-center justify-center gap-1 py-1 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--muted-foreground))]/50 transition-opacity duration-150 ease-[ease] hover:decoration-[hsl(var(--foreground))]"
              style={{ opacity: sortColumn === "conformes" ? 1 : 0.7 }}
            >
              Conforme <SortArrowIcon active={sortColumn === "conformes"} direction={sortColumn === "conformes" ? sortDirection : null} />
            </button>
            <button
              type="button"
              role="columnheader"
              aria-sort={sortColumn === "naoConformes" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => handleSort("naoConformes")}
              className="group flex cursor-pointer items-center justify-center gap-1 py-1 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--muted-foreground))]/50 transition-opacity duration-150 ease-[ease] hover:decoration-[hsl(var(--foreground))]"
              style={{ opacity: sortColumn === "naoConformes" ? 1 : 0.7 }}
            >
              Não conf. <SortArrowIcon active={sortColumn === "naoConformes"} direction={sortColumn === "naoConformes" ? sortDirection : null} />
            </button>
            <button
              type="button"
              role="columnheader"
              aria-sort={sortColumn === "pendentes" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => handleSort("pendentes")}
              className="group flex cursor-pointer items-center justify-center gap-1 py-1 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--muted-foreground))]/50 transition-opacity duration-150 ease-[ease] hover:decoration-[hsl(var(--foreground))]"
              style={{ opacity: sortColumn === "pendentes" ? 1 : 0.7 }}
            >
              Pendente <SortArrowIcon active={sortColumn === "pendentes"} direction={sortColumn === "pendentes" ? sortDirection : null} />
            </button>
            <button
              type="button"
              role="columnheader"
              aria-sort={sortColumn === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => handleSort("status")}
              className="group flex cursor-pointer items-center justify-center gap-1 py-1 text-center text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--muted-foreground))]/50 transition-opacity duration-150 ease-[ease] hover:decoration-[hsl(var(--foreground))]"
              style={{ opacity: sortColumn === "status" ? 1 : 0.7 }}
            >
              Status <SortArrowIcon active={sortColumn === "status"} direction={sortColumn === "status" ? sortDirection : null} />
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] py-4">Nenhuma auditoria.</p>
          ) : (
            recent.map((a) => {
              const displayStatus = getDisplayStatus(a);
              return (
                <Link
                  key={a.id}
                  href={`/auditorias/${a.id}`}
                  className="grid items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 lg:px-6 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-1 hover:border-[var(--color-accent)] transition-all duration-150 [grid-template-columns:1fr_8rem_8rem_3.5rem_4.5rem_4.5rem_4.5rem_5.5rem]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[hsl(var(--foreground))] truncate">{getDisplayCode(a)}</p>
                  </div>
                  <div className="text-center text-sm tabular-nums text-[hsl(var(--muted-foreground))] whitespace-nowrap">{formatDateLocal(a.plannedDate ?? a.startDate, { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")}</div>
                  <div className="text-center text-sm tabular-nums text-[hsl(var(--muted-foreground))] whitespace-nowrap">{formatDateLocal(a.createdDate, { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")}</div>
                  <div className="text-right tabular-nums">
                    {a.score != null ? (
                      <span className={`font-semibold ${getScoreColorClass(Math.min(100, a.score))}`}>{Math.min(100, a.score)}%</span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </div>
                  <div className="text-center tabular-nums text-sm text-[var(--color-success)]">{a.conformes ?? 0}</div>
                  <div className="text-center tabular-nums text-sm text-[var(--color-danger)]">{a.naoConformes ?? 0}</div>
                  <div className="text-center tabular-nums text-sm text-[var(--color-text-muted)]">{a.pendentes ?? 0}</div>
                  <div className="flex justify-center">
                    <span className={`rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold ${AUDIT_STATUS_BADGE_CLASS[displayStatus] ?? "badge-status-nao-iniciado"}`}>
                      {AUDIT_STATUS_LABELS[displayStatus] ?? displayStatus}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
      {all.length > PER_PAGE && (
        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
          aria-label="Navegação entre páginas"
        >
          <Link
            href={page > 1 ? `/auditorias?page=${page - 1}` : "#"}
            className={`rounded-lg px-2 sm:px-3 py-2 text-sm font-medium ${
              page > 1
                ? "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                : "pointer-events-none text-[hsl(var(--muted-foreground))] opacity-50"
            }`}
            aria-disabled={page <= 1}
          >
            Anterior
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/auditorias?page=${p}`}
                className={`min-w-[2rem] sm:min-w-[2.25rem] rounded-lg px-2 sm:px-3 py-2 text-center text-sm font-medium ${
                  p === page
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
          <Link
            href={page < totalPages ? `/auditorias?page=${page + 1}` : "#"}
            className={`rounded-lg px-2 sm:px-3 py-2 text-sm font-medium ${
              page < totalPages
                ? "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                : "pointer-events-none text-[hsl(var(--muted-foreground))] opacity-50"
            }`}
            aria-disabled={page >= totalPages}
          >
            Próximo
          </Link>
        </nav>
      )}
    </Container>
  );
}
