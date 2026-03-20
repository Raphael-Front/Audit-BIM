"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { useState, useEffect, useMemo, useRef } from "react";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import { auditGet, auditItems, auditUpdateItem, auditUploadEvidence, auditDeleteEvidence, auditFinishVerification, auditComplete, auditAddCustomItem, libraryCategories, libraryGetOutrosCategory, buildNcsIncompletosMessage, type AuditDetail, type AuditItemRow } from "@/lib/api";
import { EvidenciaLink } from "@/components/evidencias/EvidenciaLink";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "NOT_STARTED", label: "Pendente" },
  { value: "CONFORMING", label: "Conforme" },
  { value: "NONCONFORMING", label: "Não conforme" },
  { value: "OBSERVATION", label: "Observação" },
  { value: "NA", label: "N/A" },
  { value: "CORRIGIDO", label: "Corrigido" },
];

function getStatusLabel(status: string): string {
  const option = STATUS_OPTIONS.find((opt) => opt.value === status);
  return option?.label ?? status;
}

function getCategoryName(item: AuditItemRow): string {
  const name = item.checklistItem?.category?.name ?? item.customItem?.category?.name;
  return name?.trim() || "Sem categoria";
}

export function ExecucaoPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [evidenceText, setEvidenceText] = useState<Record<string, string>>({});
  const [construflowRef, setConstruflowRef] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [modalItemPersonalizadoOpen, setModalItemPersonalizadoOpen] = useState(false);
  const [confirmarItemPersonalizadoOpen, setConfirmarItemPersonalizadoOpen] = useState(false);

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
      if (cat === "Outros" && !item.customItem) continue; // Só mostra Outros se tiver item personalizado
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-items", id] });
      queryClient.invalidateQueries({ queryKey: ["audit", id] });
    },
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
      router.replace(`/auditorias/${id}`);
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
  const addCustomItem = useMutation({
    mutationFn: ({ description, categoryId }: { description: string; categoryId: string }) =>
      auditAddCustomItem(id!, { description, categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-items", id] });
      setModalItemPersonalizadoOpen(false);
    },
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
  const itensIncompletosNoForm =
    itens?.filter((i) => {
      if (i.status !== "NONCONFORMING") return false;
      const cf = (construflowRef[i.id] ?? i.construflowRef ?? "").trim();
      const ev = (evidenceText[i.id] ?? i.evidenceText ?? "").trim();
      return !cf || !ev;
    }) ?? [];
  const ncsIncompletosNoForm = itensIncompletosNoForm.length;
  const podeFinalizar =
    status &&
    (status === "nao_iniciado" || status === "em_andamento") &&
    pendentes === 0 &&
    (itens?.length ?? 0) > 0;
  const podeConcluir = status === "aguardando_apontamentos" && ncsIncompletos.length === 0;

  const categoryOptionsFromItems = useMemo(() => {
    return categories
      .map((catName) => {
        const itemsInCat = itemsByCategory[catName] ?? [];
        const first = itemsInCat[0];
        const catId = first?.categoryId ?? first?.checklistItem?.category?.id;
        if (!catId) return null;
        return { id: catId, name: catName };
      })
      .filter((c): c is { id: string; name: string } => !!c);
  }, [categories, itemsByCategory]);

  const { data: disciplinaCategories } = useQuery({
    queryKey: ["library-categories", audit?.disciplineId],
    queryFn: () => libraryCategories(audit!.disciplineId!),
    enabled: !!audit?.disciplineId,
  });
  const { data: outrosCategory } = useQuery({
    queryKey: ["library-outros", audit?.disciplineId],
    queryFn: () => libraryGetOutrosCategory(audit!.disciplineId!),
    enabled: !!audit?.disciplineId,
  });

  const categoryOptions = useMemo(() => {
    const fromItems = categoryOptionsFromItems;
    const fromDiscipline = disciplinaCategories ?? [];
    const seenIds = new Set(fromItems.map((c) => c.id));
    const extra = fromDiscipline.filter((c) => !seenIds.has(c.id));
    let result = [...fromItems, ...extra];
    const outros = outrosCategory ?? result.find((c) => c.name === "Outros");
    if (outros && !result.some((c) => c.id === outros.id)) {
      result = [...result, outros];
    }
    if (outros) {
      result = [outros, ...result.filter((c) => c.id !== outros.id)];
    }
    return result;
  }, [categoryOptionsFromItems, disciplinaCategories, outrosCategory]);

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
        <Link href={`/auditorias/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">
        <NavArrowIcon direction="back" className="h-4 w-4" />
        Auditoria
      </Link>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--macro))]">Execução</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Avalie cada item e salve. Alterações são persistidas automaticamente.</p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Clique em uma categoria para exibir os itens de checklist.</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmarItemPersonalizadoOpen(true)}
          className="shrink-0 rounded-xl border border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 px-4 py-2 text-sm font-medium text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/20"
        >
          + Item personalizado
        </button>
      </div>

      {status === "aguardando_apontamentos" && ncsIncompletosNoForm > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Preencha o Construflow ID e evidência/observações nos seguintes itens e depois clique em Concluir auditoria:</p>
          <p className="mt-2">{buildNcsIncompletosMessage(itensIncompletosNoForm)}</p>
        </div>
      )}

      {(podeFinalizar || podeConcluir) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {podeFinalizar && (
            <button
              onClick={() => finishVerification.mutate()}
              disabled={finishVerification.isPending}
              className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
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

      <div className="mt-6 space-y-3">
        {categories.map((categoryName) => {
          const items = itemsByCategory[categoryName] ?? [];
          const isExpanded = expandedCategories.has(categoryName);
          const pendentesCat = items.filter((i) => i.status === "NOT_STARTED").length;
          const conformesCat = items.filter((i) => i.status === "CONFORMING" || i.status === "CORRIGIDO").length;
          const totalCat = items.length;
          return (
            <div key={categoryName} className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${isExpanded ? "border-2 border-[hsl(var(--accent))]" : "border border-[hsl(var(--border))]"} bg-[hsl(var(--card))]`}>
              <button
                type="button"
                onClick={() => toggleCategory(categoryName)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-black/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--card))] appearance-none bg-transparent border-0"
              >
                <span className="font-semibold text-[hsl(var(--macro))]">{categoryName}</span>
                <span className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                  <span>{totalCat} itens</span>
                  {pendentesCat > 0 && <span className="text-amber-600">{pendentesCat} pendentes</span>}
                  {totalCat > 0 && <span className="text-emerald-600">{conformesCat} conformes</span>}
                  <span className="shrink-0 inline-flex items-center justify-center" aria-hidden>
                  {isExpanded ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  )}
                </span>
                </span>
              </button>
              {isExpanded && (
                <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4 space-y-6">
                  {items.map((i) => (
                    <div key={i.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[hsl(var(--foreground))]">{description(i)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium shrink-0 ${i.status === "CONFORMING" ? "bg-emerald-600 text-white" : i.status === "CORRIGIDO" ? "bg-sky-600 text-white" : i.status === "NONCONFORMING" ? "bg-red-600 text-white" : i.status === "NA" ? "bg-zinc-400 text-black" : "bg-[hsl(var(--muted))] text-[hsl(var(--macro))]"}`}>{getStatusLabel(i.status)}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleStatusChange(i.id, opt.value)}
                            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-w-[120px] text-center ${i.status === opt.value ? "border-[hsl(var(--accent))] bg-[hsl(var(--muted))]" : "border-[hsl(var(--border))] hover:bg-black/[0.06]"}`}
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
                          className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
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
                              className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
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

      {confirmarItemPersonalizadoOpen && (
        <ConfirmarItemPersonalizadoDialog
          onSim={() => {
            setConfirmarItemPersonalizadoOpen(false);
            setModalItemPersonalizadoOpen(true);
          }}
          onNao={() => setConfirmarItemPersonalizadoOpen(false)}
        />
      )}

      {modalItemPersonalizadoOpen && audit?.disciplineId && (
        <ItemPersonalizadoModal
          disciplineId={audit.disciplineId}
          categoryOptions={categoryOptions}
          onSubmit={({ description, categoryId }) => addCustomItem.mutate({ description, categoryId })}
          onClose={() => setModalItemPersonalizadoOpen(false)}
          isSubmitting={addCustomItem.isPending}
          error={addCustomItem.error instanceof Error ? addCustomItem.error.message : undefined}
        />
      )}
    </Container>
  );
}

function ConfirmarItemPersonalizadoDialog({ onSim, onNao }: { onSim: () => void; onNao: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onNao()}
    >
      <div
        className="flex w-full max-w-sm flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">
          Tem item personalizado?
        </h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          Deseja adicionar um item personalizado à auditoria?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onNao}
            className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))]"
          >
            Não
          </button>
          <button
            type="button"
            onClick={onSim}
            className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}

interface ItemPersonalizadoModalProps {
  disciplineId: string;
  categoryOptions: { id: string; name: string }[];
  onSubmit: (data: { description: string; categoryId: string }) => void;
  onClose: () => void;
  isSubmitting: boolean;
  error?: string;
}

function ItemPersonalizadoModal({ disciplineId, categoryOptions, onSubmit, onClose, isSubmitting, error }: ItemPersonalizadoModalProps) {
  const [description, setDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const { data: outrosCategory } = useQuery({
    queryKey: ["library-outros-modal", disciplineId],
    queryFn: () => libraryGetOutrosCategory(disciplineId),
    enabled: !!disciplineId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = description.trim();
    if (!desc) return;
    if (!selectedCategoryId) return;
    onSubmit({ description: desc, categoryId: selectedCategoryId });
  };

  const outrasCategorias = categoryOptions
    .filter((c) => c.name !== "Outros")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  const temOutros = !!outrosCategory;
  const opcoesFinais = temOutros
    ? [...outrasCategorias, outrosCategory!]
    : [...categoryOptions].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Adicionar item personalizado
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

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label htmlFor="custom-desc" className="mb-1 block text-sm font-medium text-[hsl(var(--foreground))]">
                Descrição do item
              </label>
              <textarea
                id="custom-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Digite a descrição do item de verificação..."
                rows={3}
                required
                className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
                Categoria
              </label>
              <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
                Selecione a categoria do item. Use &quot;Outros&quot; quando não se encaixar nas categorias existentes.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-[hsl(var(--border))] p-2">
                {opcoesFinais.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Nenhuma categoria disponível nesta auditoria.
                  </p>
                ) : (
                  opcoesFinais.map((cat) => (
                    <label
                      key={cat.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        selectedCategoryId === cat.id
                          ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                          : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.id}
                        checked={selectedCategoryId === cat.id}
                        onChange={() => setSelectedCategoryId(cat.id)}
                        className="h-4 w-4 border-[hsl(var(--border))]"
                      />
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{cat.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
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
              type="submit"
              disabled={isSubmitting || !description.trim() || !selectedCategoryId || opcoesFinais.length === 0}
              className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Adicionando…" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
