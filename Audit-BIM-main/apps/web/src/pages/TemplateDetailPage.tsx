import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import {
  authMe,
  libraryDisciplines,
  libraryCategories,
  libraryChecklistItems,
  createLibraryVerificationItem,
  updateLibraryVerificationItem,
  deleteLibraryVerificationItem,
  type DisciplineRow,
  type CategoryRow,
  type ChecklistItemRow,
} from "@/lib/api";

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPeso, setNewItemPeso] = useState(1);
  const [newItemPontosMaximo, setNewItemPontosMaximo] = useState(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editPeso, setEditPeso] = useState(1);
  const [editPontosMaximo, setEditPontosMaximo] = useState(1);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authMe });
  const canEditItems = me?.role === "admin_bim" || me?.role === "auditor_bim";

  const { data: disciplines = [] } = useQuery({ queryKey: ["disciplines"], queryFn: libraryDisciplines });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", id],
    queryFn: () => libraryCategories(id),
    enabled: !!id,
  });
  const { data: checklistItems = [] } = useQuery({
    queryKey: ["checklistItems", id],
    queryFn: () => libraryChecklistItems(id ? { disciplineId: id } : {}),
    enabled: !!id,
  });

  const addItemMutation = useMutation({
    mutationFn: (payload: { categoryId: string; itemVerificacao: string; peso?: number; pontosMaximo?: number }) =>
      createLibraryVerificationItem({
        disciplineId: id!,
        categoryId: payload.categoryId,
        itemVerificacao: payload.itemVerificacao,
        peso: payload.peso,
        pontosMaximo: payload.pontosMaximo ?? 1,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems", id] });
      setNewItemDescription("");
      setNewItemPeso(1);
      setNewItemPontosMaximo(1);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      itemId,
      itemVerificacao,
      peso,
      pontosMaximo,
    }: {
      itemId: string;
      itemVerificacao: string;
      peso: number;
      pontosMaximo: number;
    }) => updateLibraryVerificationItem(itemId, { itemVerificacao, peso, pontosMaximo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems", id] });
      setEditingItemId(null);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteLibraryVerificationItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems", id] });
    },
  });

  const discipline = (disciplines as DisciplineRow[]).find((d) => d.id === id);
  const categoryRows = categories as CategoryRow[];
  const itemsForDiscipline = checklistItems as ChecklistItemRow[];
  const itemsByCategoryId = categoryRows.reduce<Record<string, ChecklistItemRow[]>>((acc, c) => {
    acc[c.id] = itemsForDiscipline.filter((i) => i.categoryId === c.id);
    return acc;
  }, {});

  if (id && !discipline) {
    return (
      <Container>
        <p className="text-red-600">Disciplina não encontrada.</p>
        <Link to="/templates" className="mt-2 inline-block text-sm text-[hsl(var(--accent))]">← Voltar à biblioteca</Link>
      </Container>
    );
  }

  if (!discipline) return null;

  return (
    <Container>
      <div className="mb-6">
        <Link to="/templates" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">← Biblioteca</Link>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[hsl(var(--macro))]">{discipline.code ?? discipline.name}</h1>
      </div>
      <div className="mt-8">
        {selectedCategoryId == null ? (
          <>
            <h2 className="text-lg font-medium text-[hsl(var(--macro))]">Categorias</h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Clique em uma categoria para ver e gerenciar os itens de verificação.
            </p>

            {categoryRows.length === 0 && (
              <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Nenhuma categoria vinculada a esta disciplina.</p>
            )}

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {categoryRows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(c.id)}
                    className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-4 text-left shadow-sm transition hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--muted))]"
                  >
                    <span className="font-medium text-[hsl(var(--foreground))]">{c.name}</span>
                    <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
                      {(itemsByCategoryId[c.id] ?? []).length} item(ns)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className="mb-4 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]"
            >
              ← Voltar às categorias
            </button>
            {(() => {
              const selectedCat = categoryRows.find((c) => c.id === selectedCategoryId);
              if (!selectedCat) return null;
              const items = itemsByCategoryId[selectedCategoryId] ?? [];
              return (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
                  <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3">
                    <h2 className="text-lg font-semibold text-[hsl(var(--macro))]">{selectedCat.name}</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Itens de verificação desta categoria</p>
                  </div>
                  <div className="px-4 py-4">
                    <ul className="space-y-2">
                      {items.map((i) => (
                        <li key={i.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                          {editingItemId === i.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const desc = editDescription.trim();
                                if (!desc) return;
                                updateItemMutation.mutate(
                                  {
                                    itemId: i.id,
                                    itemVerificacao: desc,
                                    peso: editPeso,
                                    pontosMaximo: editPontosMaximo,
                                  },
                                  { onError: () => {} }
                                );
                              }}
                              className="space-y-2"
                            >
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Descrição"
                                rows={2}
                                className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                              />
                              <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                  Peso:
                                  <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={editPeso}
                                    onChange={(e) => setEditPeso(parseInt(e.target.value, 10) || 1)}
                                    className="w-14 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                                  />
                                </label>
                                <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                  Pontos máx:
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={editPontosMaximo}
                                    onChange={(e) => setEditPontosMaximo(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className="w-16 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={updateItemMutation.isPending || !editDescription.trim()}
                                  className="rounded-md bg-[hsl(var(--accent))] px-3 py-1.5 text-sm text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                                >
                                  {updateItemMutation.isPending ? "Salvando…" : "Salvar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItemId(null)}
                                  className="rounded-md px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                                >
                                  Cancelar
                                </button>
                              </div>
                              {updateItemMutation.isError && (
                                <p className="text-sm text-red-600">{String(updateItemMutation.error?.message)}</p>
                              )}
                            </form>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-[hsl(var(--foreground))]">{i.description}</p>
                                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Peso: {i.weight} • Pontos máx: {i.maxPoints}</p>
                              </div>
                              {canEditItems && (
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemId(i.id);
                                      setEditDescription(i.description);
                                      setEditPeso(i.weight);
                                      setEditPontosMaximo(Math.round(i.maxPoints) || 1);
                                    }}
                                    className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--macro))] hover:bg-[hsl(var(--muted))]"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm("Excluir este item de verificação? Ele será desativado e não aparecerá em novas auditorias.")) {
                                        deleteItemMutation.mutate(i.id);
                                      }
                                    }}
                                    disabled={deleteItemMutation.isPending}
                                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                      {items.length === 0 && (
                        <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhum item nesta categoria.</li>
                      )}
                    </ul>
                    {canEditItems && (
                      <div className="mt-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const desc = newItemDescription.trim();
                            if (!desc) return;
                            addItemMutation.mutate(
                              {
                                categoryId: selectedCategoryId,
                                itemVerificacao: desc,
                                peso: newItemPeso,
                                pontosMaximo: Math.max(1, Math.round(newItemPontosMaximo) || 1),
                              },
                              { onError: () => {} }
                            );
                          }}
                          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3"
                        >
                          <label className="block text-sm font-medium text-[hsl(var(--foreground))]">Adicionar item de verificação</label>
                          <textarea
                            value={newItemDescription}
                            onChange={(e) => setNewItemDescription(e.target.value)}
                            placeholder="Descrição do item"
                            rows={2}
                            className="mt-1 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                              Peso:
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={newItemPeso}
                                onChange={(e) => setNewItemPeso(parseInt(e.target.value, 10) || 1)}
                                className="w-14 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                              Pontos máx:
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={newItemPontosMaximo}
                                onChange={(e) => setNewItemPontosMaximo(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-16 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                              />
                            </label>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="submit"
                              disabled={addItemMutation.isPending || !newItemDescription.trim()}
                              className="rounded-md bg-[hsl(var(--accent))] px-3 py-2 text-sm text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                            >
                              {addItemMutation.isPending ? "Salvando…" : "Adicionar"}
                            </button>
                          </div>
                          {addItemMutation.isError && (
                            <p className="mt-2 text-sm text-red-600">{String(addItemMutation.error?.message)}</p>
                          )}
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </Container>
  );
}
