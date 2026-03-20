"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import { workGet, workUpdate, auditsList, AUDIT_STATUS_LABELS, AUDIT_STATUS_BADGE_CLASS, getDisplayStatus, type WorkRow, type AuditListItem } from "@/lib/api";
import { getScoreColorClass } from "@/views/RelatoriosPage";
import { useAuth } from "@/contexts/AuthContext";
import { Pencil, Check, X } from "lucide-react";

export function ObraDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const isAdmin = me?.role === "admin_bim";

  const { data: obra, isError, isPending } = useQuery({
    queryKey: ["work", id],
    queryFn: () => workGet(id!),
    enabled: !!id,
  });
  const { data: audits = [] } = useQuery({
    queryKey: ["audits", id],
    queryFn: () => auditsList({ workId: id! }),
    enabled: !!id,
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => workUpdate(id!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work", id] });
      setEditingName(false);
    },
  });

  function startEdit() {
    setEditNameValue((obra as WorkRow).name);
    setEditingName(true);
  }

  function cancelEdit() {
    setEditingName(false);
  }

  function saveEdit() {
    const trimmed = editNameValue.trim();
    if (!trimmed || trimmed === (obra as WorkRow).name) {
      setEditingName(false);
      return;
    }
    updateNameMutation.mutate(trimmed);
  }

  if (isPending && !!id) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--accent))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando obra...</p>
        </div>
      </Container>
    );
  }

  if (isError || (id && !obra)) {
    return (
      <Container>
        <p className="text-red-600">Obra não encontrada.</p>
        <Link href="/obras" className="mt-2 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--accent))]">
        <NavArrowIcon direction="back" className="h-4 w-4" />
        Obras
      </Link>
      </Container>
    );
  }

  if (!obra) return null;

  return (
    <Container>
      <div className="mb-6">
        <Link href="/obras" className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">
        <NavArrowIcon direction="back" className="h-4 w-4" />
        Obras
      </Link>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] border-l-4 border-l-[var(--color-accent)]">
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && editingName ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xl font-bold text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                style={{ fontFamily: "var(--font-display)" }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
              <button
                type="button"
                onClick={saveEdit}
                disabled={updateNameMutation.isPending || !editNameValue.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-success)] px-2.5 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Salvar
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={updateNameMutation.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-sm font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[var(--color-primary)]" style={{ fontFamily: "var(--font-display)" }}>{(obra as WorkRow).name}</h1>
              {isAdmin && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                  title="Editar nome da obra"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
        {(obra as WorkRow).code && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Código: {(obra as WorkRow).code}</p>
        )}
        <span className={`mt-2 inline-block rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold ${(obra as WorkRow).active ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : "bg-[var(--color-bg)] text-[var(--color-text-muted)]"}`}>{(obra as WorkRow).active ? "Ativa" : "Inativa"}</span>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[hsl(var(--macro))]">Auditorias desta obra</h2>
        {/* Cabeçalho com grid fixo para alinhamento perfeito */}
        <div className="mt-4 grid grid-cols-[1fr_3.5rem_4.5rem_4.5rem_4.5rem_5.5rem] items-center gap-4 rounded-t-lg border border-b-0 border-[var(--color-border)] bg-[#F4F6F9] px-6 py-3">
          <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Auditoria</span>
          <span className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Score</span>
          <span className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Conforme</span>
          <span className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Não conf.</span>
          <span className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Pendente</span>
          <span className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Status</span>
        </div>
        <ul className="mt-0 space-y-4">
          {(audits as AuditListItem[]).map((a) => (
            <li key={a.id}>
              <Link
                href={`/auditorias/${a.id}`}
                className="grid grid-cols-[1fr_3.5rem_4.5rem_4.5rem_4.5rem_5.5rem] items-center gap-4 rounded-lg border border-[var(--color-border)] bg-white px-6 py-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[var(--color-bg)] hover:border-[var(--color-accent)] transition-all duration-150 no-underline"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[hsl(var(--foreground))] truncate">{a.code ?? a.title ?? a.id}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Planejada: {a.plannedDate ?? a.startDate ?? "—"} · Criada: {a.createdDate ?? "—"}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  {a.score != null ? (
                    <span className={`font-semibold ${getScoreColorClass(Math.min(100, a.score))}`}>
                      {Math.min(100, a.score)}%
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">—</span>
                  )}
                </div>
                <div className="text-center tabular-nums text-sm text-[var(--color-success)]">{a.conformes ?? 0}</div>
                <div className="text-center tabular-nums text-sm text-[var(--color-danger)]">{a.naoConformes ?? 0}</div>
                <div className="text-center tabular-nums text-sm text-[var(--color-text-muted)]">{a.pendentes ?? 0}</div>
                <div className="flex justify-center">
                  <span className={`inline-flex items-center justify-center rounded-[20px] px-2.5 py-1 text-[11px] font-semibold leading-tight ${AUDIT_STATUS_BADGE_CLASS[getDisplayStatus(a)] ?? "badge-status-nao-iniciado"}`}>
                    {AUDIT_STATUS_LABELS[getDisplayStatus(a)] ?? getDisplayStatus(a)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {audits.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria.</li>}
        </ul>
      </div>
    </Container>
  );
}
