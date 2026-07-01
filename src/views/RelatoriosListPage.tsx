"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { RelatorioGeralModal } from "@/components/relatorios/RelatorioGeralModal";
import { DateRangePicker } from "@/components/DateRangePicker";
import { auditsList, AUDIT_STATUS_BADGE_CLASS, getDisplayStatus, type AuditListItem } from "@/lib/api";
import { useObra } from "@/contexts/ObraContext";

const PAGE_SIZE = 15;

const statusLabel: Record<string, string> = {
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

export function RelatoriosListPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { selectedObraId } = useObra();
  const workId = selectedObraId ?? "";
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [workId, dateRange.from, dateRange.to]);

  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["audits", "concluida", workId, dateRange.from, dateRange.to],
    queryFn: () =>
      auditsList({
        status: "concluida",
        workId: workId || undefined,
        dateFrom: dateRange.from || undefined,
        dateTo: dateRange.to || undefined,
      }),
  });

  const totalPages = Math.ceil(auditorias.length / PAGE_SIZE) || 1;
  const paginatedAuditorias = auditorias.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Container>
      <PageHeader
        title="Relatórios"
        subtitle={
          <>
            Selecione uma auditoria para ver o relatório com o score,
            <br />
            resumo por disciplina e não conformidades.
          </>
        }
        actions={
          <div className="flex flex-nowrap items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-xs font-medium hover:bg-[hsl(var(--muted))]"
            >
              <FileBarChart className="h-4 w-4" />
              Relatório geral
            </button>
          </div>
        }
      />
      <RelatorioGeralModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="mt-8 space-y-4">
        {isLoading && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando auditorias…</p>
        )}
        {!isLoading && auditorias.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria para exibir relatório.</p>
        )}
        {!isLoading && paginatedAuditorias.map((a: AuditListItem) => (
          <Link
            key={a.id}
            href={`/relatorios/${a.id}`}
            className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-5 shadow-sm hover:border-[hsl(var(--ring))] transition-colors"
          >
            <div>
              <p className="font-medium text-[hsl(var(--foreground))]">{a.code ?? a.title ?? a.id}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {a.work?.name ?? ""} • {a.phase?.name ?? ""} • {a.plannedDate ?? a.startDate ?? "Sem data"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${AUDIT_STATUS_BADGE_CLASS[getDisplayStatus(a)] ?? "badge-status-nao-iniciado"}`}>
                {statusLabel[getDisplayStatus(a)] ?? getDisplayStatus(a)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]">
                <FileBarChart className="h-4 w-4" />
                Ver relatório
              </span>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && auditorias.length > 0 && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Página {page} de {totalPages} ({auditorias.length} relatórios)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </Container>
  );
}
