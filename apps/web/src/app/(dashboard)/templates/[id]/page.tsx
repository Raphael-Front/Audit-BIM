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
  const [targetDisciplineId, setTargetDisciplineId] = useState("");

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
      setLinkingCategory(null);
      setTargetDisciplineId("");
    },
  });

  const discipline = (disciplines as DisciplineRow[]).find((d) => d.id === id);
  const otherDisciplines = (disciplines as DisciplineRow[]).filter((d) => d.id !== id);
  const categoryIds = (categories as CategoryRow[]).map((c) => c.id);
  const itemsForDiscipline = (checklistItems as ChecklistItemRow[]).filter((item) =>
    categoryIds.includes(item.categoryId)
  );

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingCategory || !targetDisciplineId) return;
    linkMutation.mutate({ categoryId: linkingCategory.id, disciplineId: targetDisciplineId });
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
                  onClick={() => setLinkingCategory({ id: c.id, name: c.name })}
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
              <select
                value={targetDisciplineId}
                onChange={(e) => setTargetDisciplineId(e.target.value)}
                required
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
              >
                <option value="">Selecione a disciplina</option>
                {otherDisciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={linkMutation.isPending || !targetDisciplineId}
                className="rounded-md bg-[hsl(var(--accent))] px-3 py-2 text-sm text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
              >
                {linkMutation.isPending ? "Salvando…" : "Vincular"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkingCategory(null);
                  setTargetDisciplineId("");
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
