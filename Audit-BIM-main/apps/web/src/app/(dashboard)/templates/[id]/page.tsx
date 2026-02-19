import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import {
  libraryDisciplines,
  libraryCategories,
  libraryChecklistItems,
  libraryLinkCategoryToDiscipline,
  createLibraryVerificationItem,
  type DisciplineRow,
  type CategoryRow,
  type ChecklistItemRow,
} from "@/lib/api";

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [linkingCategory, setLinkingCategory] = useState<{ id: string; name: string } | null>(null);
  const [targetDisciplineIds, setTargetDisciplineIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPeso, setNewItemPeso] = useState(1);
  const [newItemPontosMaximo, setNewItemPontosMaximo] = useState(1);

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

  const linkMutation = useMutation({
    mutationFn: ({
      categoryId,
      disciplineId,
    }: {
      categoryId: string;
      disciplineId: string;
    }) => libraryLinkCategoryToDiscipline(categoryId, disciplineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (payload: { categoryId: string; itemVerificacao: string; peso?: number; pontosMaximo?: number }) =>
      createLibraryVerificationItem({
        disciplineId: id!,
        categoryId: payload.categoryId,
        itemVerificacao: payload.itemVerificacao,
        peso: payload.peso,
        pontosMaximo: payload.pontosMaximo,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems", id] });
      setNewItemDescription("");
      setNewItemPeso(1);
      setNewItemPontosMaximo(1);
    },
  });

  const discipline = (disciplines as DisciplineRow[]).find((d) => d.id === id);
  const otherDisciplines = (disciplines as DisciplineRow[]).filter((d) => d.id !== id);
  const categoryRows = categories as CategoryRow[];
  const itemsForDiscipline = checklistItems as ChecklistItemRow[];
  const itemsByCategoryId = categoryRows.reduce<Record<string, ChecklistItemRow[]>>((acc, c) => {
    acc[c.id] = itemsForDiscipline.filter((i) => i.categoryId === c.id);
    return acc;
  }, {});

  const allOtherIds = otherDisciplines.map((d) => d.id);
  const isAllSelected = otherDisciplines.length > 0 && targetDisciplineIds.length === otherDisciplines.length;

  const handleSelectAll = () => {
    setTargetDisciplineIds(isAllSelected ? [] : allOtherIds);
  };

  const handleToggleDiscipline = (disciplineId: string) => {
    setTargetDisciplineIds((prev) =>
      prev.includes(disciplineId) ? prev.filter((id) => id !== disciplineId) : [...prev, disciplineId]
    );
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingCategory || targetDisciplineIds.length === 0) return;
    try {
      for (const disciplineId of targetDisciplineIds) {
        await linkMutation.mutateAsync({ categoryId: linkingCategory.id, disciplineId });
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setLinkingCategory(null);
      setTargetDisciplineIds([]);
    } catch {
      // erro já exibido por linkMutation.isError
    }
  };

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
        <Link to="/templates" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">← Biblioteca</Link>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">{discipline.code ?? discipline.name}</h1>
      </div>
      <div className="mt-8">
        {selectedCategoryId == null ? (
          <>
            <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Categorias</h2>
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
                  {otherDisciplines.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLinkingCategory({ id: c.id, name: c.name });
                        setTargetDisciplineIds([]);
                      }}
                      className="mt-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      Vincular a outra disciplina
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className="mb-4 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
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
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{selectedCat.name}</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Itens de verificação desta categoria</p>
                  </div>
                  <div className="px-4 py-4">
                    <ul className="space-y-2">
                      {items.map((i) => (
                        <li key={i.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                          <p className="font-medium text-[hsl(var(--foreground))]">{i.description}</p>
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Peso: {i.weight} • Pontos máx: {i.maxPoints}</p>
                        </li>
                      ))}
                      {items.length === 0 && (
                        <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhum item nesta categoria.</li>
                      )}
                    </ul>
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
                              pontosMaximo: newItemPontosMaximo,
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
                          className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <span className="text-[hsl(var(--muted-foreground))]">Peso:</span>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={newItemPeso}
                              onChange={(e) => setNewItemPeso(Number(e.target.value) || 1)}
                              className="w-14 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <span className="text-[hsl(var(--muted-foreground))]">Pontos máx:</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={newItemPontosMaximo}
                              onChange={(e) => setNewItemPontosMaximo(Number(e.target.value) || 1)}
                              className="w-16 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
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
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {linkingCategory && (
          <form
            onSubmit={handleLinkSubmit}
            className="mt-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4"
          >
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              Vincular &quot;{linkingCategory.name}&quot; a:
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                {isAllSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2">
              {otherDisciplines.map((d) => (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[hsl(var(--muted))]"
                >
                  <input
                    type="checkbox"
                    checked={targetDisciplineIds.includes(d.id)}
                    onChange={() => handleToggleDiscipline(d.id)}
                    className="h-4 w-4 rounded border-[hsl(var(--border))]"
                  />
                  <span className="text-sm">{d.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={linkMutation.isPending || targetDisciplineIds.length === 0}
                className="rounded-md bg-[hsl(var(--accent))] px-3 py-2 text-sm text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
              >
                {linkMutation.isPending ? "Salvando…" : "Vincular"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkingCategory(null);
                  setTargetDisciplineIds([]);
                }}
                className="rounded-md px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))]"
              >
                Cancelar
              </button>
            </div>
            {linkMutation.isError && (
              <p className="mt-2 text-sm text-red-600">{String(linkMutation.error?.message)}</p>
            )}
          </form>
        )}
      </div>
    </Container>
  );
}
