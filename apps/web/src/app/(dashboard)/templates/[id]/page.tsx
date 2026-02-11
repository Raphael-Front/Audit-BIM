import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import {
  libraryDisciplines,
  libraryCategories,
  libraryChecklistItems,
  libraryLinkCategoryToDiscipline,
  type DisciplineRow,
  type CategoryRow,
  type ChecklistItemRow,
} from "@/lib/api";

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [linkingCategory, setLinkingCategory] = useState<{ id: string; name: string } | null>(null);
  const [targetDisciplineIds, setTargetDisciplineIds] = useState<string[]>([]);

  const { data: disciplines = [] } = useQuery({ queryKey: ["disciplines"], queryFn: libraryDisciplines });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", id],
    queryFn: () => libraryCategories(id),
    enabled: !!id,
  });
  const { data: checklistItems = [] } = useQuery({
    queryKey: ["checklistItems"],
    queryFn: () => libraryChecklistItems({}),
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

  const discipline = (disciplines as DisciplineRow[]).find((d) => d.id === id);
  const otherDisciplines = (disciplines as DisciplineRow[]).filter((d) => d.id !== id);
  const categoryIds = (categories as CategoryRow[]).map((c) => c.id);
  const itemsForDiscipline = (checklistItems as ChecklistItemRow[]).filter((item) =>
    categoryIds.includes(item.categoryId)
  );

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
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">{discipline.name}</h1>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Ordem: {discipline.order}</p>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Categorias</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Vincule uma categoria a outra disciplina para reutilizá-la sem duplicar.
        </p>
        <ul className="mt-4 space-y-2">
          {(categories as CategoryRow[]).map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2 font-medium text-[hsl(var(--foreground))]"
            >
              <span>{c.name}</span>
              {otherDisciplines.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                  setLinkingCategory({ id: c.id, name: c.name });
                  setTargetDisciplineIds([]);
                }}
                  className="rounded-md bg-[hsl(var(--muted))] px-2 py-1 text-xs font-normal text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                >
                  Vincular a outra disciplina
                </button>
              )}
            </li>
          ))}
          {categories.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma categoria.</li>}
        </ul>

        {linkingCategory && (
          <form
            onSubmit={handleLinkSubmit}
            className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4"
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
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Itens de checklist</h2>
        <ul className="mt-4 space-y-2">
          {itemsForDiscipline.map((i) => (
            <li key={i.id} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3">
              <p className="font-medium text-[hsl(var(--foreground))]">{i.description}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Peso: {i.weight} • Pontos máx: {i.maxPoints}</p>
            </li>
          ))}
          {itemsForDiscipline.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhum item.</li>}
        </ul>
      </div>
    </Container>
  );
}
