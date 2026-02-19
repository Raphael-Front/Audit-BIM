import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { useState, useEffect, useMemo, useRef } from "react";
import { auditGet, auditItems, auditUpdateItem, auditUploadEvidence, auditDeleteEvidence, auditFinishVerification, auditComplete, type AuditDetail, type AuditItemRow } from "@/lib/api";
import { EvidenciaLink } from "@/components/evidencias/EvidenciaLink";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "NOT_STARTED", label: "Pendente" },
  { value: "CONFORMING", label: "Conforme" },
  { value: "NONCONFORMING", label: "Não conforme" },
  { value: "OBSERVATION", label: "Observação" },
  { value: "NA", label: "N/A" },
];

const CATEGORIA_OUTROS = "Outros";

function getCategoryName(item: AuditItemRow): string {
  const name = item.checklistItem?.category?.name ?? item.customItem?.category?.name;
  return name?.trim() || CATEGORIA_OUTROS;
}

export default function ExecucaoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [evidenceText, setEvidenceText] = useState<Record<string, string>>({});
  const [construflowRef, setConstruflowRef] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data: audit } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => auditGet(id!),
    enabled: !!id,
  });
  const { data: itens, isLoading } = useQuery({
    queryKey: ["audit-items", id],
    queryFn: () => auditItems(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!itens) return;
    const ev: Record<string, string> = {};
    const cf: Record<string, string> = {};
    itens.forEach((i) => {
      ev[i.id] = i.evidenceText ?? "";
      cf[i.id] = i.construflowRef ?? "";
    });
    setEvidenceText(ev);
    setConstruflowRef(cf);
  }, [itens]);

  const { categories, itemsByCategory } = useMemo(() => {
    if (!itens?.length) return { categories: [] as string[], itemsByCategory: {} as Record<string, AuditItemRow[]> };
    const byCategory: Record<string, AuditItemRow[]> = {};
    const order: string[] = [];
    for (const item of itens) {
      const cat = getCategoryName(item);
      if (!byCategory[cat]) {
        byCategory[cat] = [];
        order.push(cat);
      }
      byCategory[cat].push(item);
    }
    return { categories: order, itemsByCategory: byCategory };
  }, [itens]);

  function toggleCategory(categoryName: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  }

  const updateItem = useMutation({
    mutationFn: async ({ itemId, status, evidenceText: ev, construflowRef: cf }: { itemId: string; status?: string; evidenceText?: string; construflowRef?: string }) => {
      await auditUpdateItem(id!, itemId, { status, evidenceText: ev, construflowRef: cf });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-items", id] }),
  });
  const finishVerification = useMutation({
    mutationFn: () => auditFinishVerification(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-items", id] });
    },
  });
  const completeAudit = useMutation({
    mutationFn: () => auditComplete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit", id] });
      queryClient.invalidateQueries({ queryKey: ["audit-items", id] });
      navigate(`/auditorias/${id}`, { replace: true });
    },
  });

  const uploadEvidence = useMutation({
    mutationFn: ({ itemId, file }: { itemId: string; file: File }) => auditUploadEvidence(id!, itemId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-items", id] }),
  });
  const deleteEvidence = useMutation({
    mutationFn: ({ anexoId, storagePath }: { anexoId: string; storagePath: string }) =>
      auditDeleteEvidence(anexoId, storagePath),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-items", id] }),
  });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleStatusChange(itemId: string, status: string) {
    updateItem.mutate({ itemId, status, evidenceText: evidenceText[itemId], construflowRef: construflowRef[itemId] || undefined });
  }

  function handleBlur(itemId: string) {
    const item = itens?.find((i) => i.id === itemId);
    if (!item) return;
    if (evidenceText[itemId] !== (item.evidenceText ?? "") || construflowRef[itemId] !== (item.construflowRef ?? "")) {
      updateItem.mutate({
        itemId,
        evidenceText: evidenceText[itemId],
        construflowRef: construflowRef[itemId] || undefined,
      });
    }
  }

  function description(item: AuditItemRow): string {
    return item.checklistItem?.description ?? item.customItem?.description ?? item.id;
  }

  const status = (audit as AuditDetail)?.status as string | undefined;
  const pendentes = itens?.filter((i) => i.status === "NOT_STARTED").length ?? 0;
  const ncsIncompletos =
    itens?.filter(
      (i) =>
        i.status === "NONCONFORMING" &&
        (!(i.construflowRef && i.construflowRef.trim()) || !(i.evidenceText && i.evidenceText.trim()))
    ) ?? [];
  const ncsIncompletosNoForm = itens?.filter((i) => {
    if (i.status !== "NONCONFORMING") return false;
    const cf = (construflowRef[i.id] ?? i.construflowRef ?? "").trim();
    const ev = (evidenceText[i.id] ?? i.evidenceText ?? "").trim();
    return !cf || !ev;
  }).length ?? 0;
  const podeFinalizar =
    status &&
    (status === "nao_iniciado" || status === "em_andamento") &&
    pendentes === 0 &&
    (itens?.length ?? 0) > 0;
  const podeConcluir = status === "aguardando_apontamentos" && ncsIncompletos.length === 0;

  if (isLoading || !itens) {
    return (
      <Container>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando…</p>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-6 flex items-center justify-between">
        <Link to={`/auditorias/${id}`} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">← Auditoria</Link>
      </div>
      <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Execução</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Avalie cada item e salve. Alterações são persistidas automaticamente.</p>

      {status === "aguardando_apontamentos" && ncsIncompletosNoForm > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Preencha o Construflow ID e evidência/observações em cada item não conforme e depois clique em Concluir auditoria.
        </p>
      )}

      {(podeFinalizar || podeConcluir) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {podeFinalizar && (
            <button
              onClick={() => finishVerification.mutate()}
              disabled={finishVerification.isPending}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {finishVerification.isPending ? "Processando..." : "Finalizar verificação"}
            </button>
          )}
          {podeConcluir && (
            <button
              onClick={() => completeAudit.mutate()}
              disabled={completeAudit.isPending}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {completeAudit.isPending ? "Processando..." : "Concluir auditoria"}
            </button>
          )}
        </div>
      )}

      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Clique em uma categoria para exibir os itens de checklist.</p>

      <div className="mt-6 space-y-3">
        {categories.map((categoryName) => {
          const items = itemsByCategory[categoryName] ?? [];
          const isExpanded = expandedCategories.has(categoryName);
          const pendentesCat = items.filter((i) => i.status === "NOT_STARTED").length;
          const conformesCat = items.filter((i) => i.status === "CONFORMING").length;
          const totalCat = items.length;
          return (
            <div key={categoryName} className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${isExpanded ? "border-2 border-[hsl(var(--accent))]" : "border border-[hsl(var(--border))]"} bg-[hsl(var(--card))]`}>
              <button
                type="button"
                onClick={() => toggleCategory(categoryName)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-black/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--card))] appearance-none bg-transparent border-0"
              >
                <span className="font-semibold text-[hsl(var(--foreground))]">{categoryName}</span>
                <span className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                  <span>{totalCat} itens</span>
                  {pendentesCat > 0 && <span className="text-amber-600">{pendentesCat} pendentes</span>}
                  {totalCat > 0 && <span className="text-emerald-600">{conformesCat} conformes</span>}
                  <span className="shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden>{isExpanded ? "▼" : "▶"}</span>
                </span>
              </button>
              {isExpanded && (
                <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-4 space-y-6">
                  {items.map((i) => (
                    <div key={i.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[hsl(var(--foreground))]">{description(i)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium shrink-0 ${i.status === "CONFORMING" ? "bg-emerald-600 text-white" : i.status === "NONCONFORMING" ? "bg-red-600 text-white" : i.status === "NA" ? "bg-zinc-400 text-black" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>{i.status}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleStatusChange(i.id, opt.value)}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${i.status === opt.value ? "border-[hsl(var(--ring))] bg-[hsl(var(--muted))]" : "border-[hsl(var(--border))] hover:bg-black/[0.06]"}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 space-y-2">
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))]">Evidência / Observações</label>
                        <textarea
                          value={evidenceText[i.id] ?? ""}
                          onChange={(e) => setEvidenceText((prev) => ({ ...prev, [i.id]: e.target.value }))}
                          onBlur={() => handleBlur(i.id)}
                          rows={2}
                          className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                        />
                        {i.status === "NONCONFORMING" && (
                          <>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">Construflow ID</label>
                            <input
                              type="text"
                              value={construflowRef[i.id] ?? ""}
                              onChange={(e) => setConstruflowRef((prev) => ({ ...prev, [i.id]: e.target.value }))}
                              onBlur={() => handleBlur(i.id)}
                              placeholder="ID do apontamento"
                              className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                            />
                            <div className="mt-3">
                              <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Anexar foto de evidência</label>
                              <div className="flex flex-wrap gap-2 items-center">
                                <input
                                  ref={(el) => { fileInputRefs.current[i.id] = el; }}
                                  type="file"
                                  accept="image/jpeg,image/png,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      uploadEvidence.mutate({ itemId: i.id, file }, {
                                        onSuccess: () => { e.target.value = ""; },
                                      });
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => fileInputRefs.current[i.id]?.click()}
                                  disabled={uploadEvidence.isPending}
                                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                                >
                                  {(uploadEvidence.isPending && uploadEvidence.variables?.itemId === i.id) ? "Enviando…" : "Selecionar imagem"}
                                </button>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">JPG, PNG ou PDF. Máx. 10MB</span>
                              </div>
                              {(i.anexos?.length ?? 0) > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {i.anexos!.map((a) => (
                                    <li key={a.id}>
                                      <EvidenciaLink
                                        anexo={a}
                                        onDelete={async () =>
                                          deleteEvidence.mutateAsync({ anexoId: a.id, storagePath: a.arquivoUrl })
                                        }
                                      />
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Container>
  );
}
