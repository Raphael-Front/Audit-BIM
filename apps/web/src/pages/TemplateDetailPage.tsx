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

export function TemplateDetailPage() {
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
        <Link to="/templates" className="mt-2 inline-block text-sm text-blue-600">← Voltar à biblioteca</Link>
      </Container>
    );
  }

  if (!discipline) return null;

  return (
    <Container>
      <div className="mb-6">
        <Link to="/templates" className="text-sm text-gray-500 hover:text-gray-900">← Biblioteca</Link>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">{discipline.name}</h1>
        <p className="mt-2 text-xs text-gray-500">Ordem: {discipline.order}</p>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Categorias</h2>
        <p className="mt-1 text-sm text-gray-500">
          Vincule uma categoria a outra disciplina para reutilizá-la sem duplicar.
        </p>
        <ul className="mt-4 space-y-2">
          {(categories as CategoryRow[]).map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-900"
            >
              <span>{c.name}</span>
              {otherDisciplines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLinkingCategory({ id: c.id, name: c.name })}
                  className="rounded-md bg-gray-100 px-2 py-1 text-xs font-normal text-gray-600 hover:bg-gray-200"
                >
                  Vincular a outra disciplina
                </button>
              )}
            </li>
          ))}
          {categories.length === 0 && <li className="text-sm text-gray-500">Nenhuma categoria.</li>}
        </ul>

        {linkingCategory && (
          <form
            onSubmit={handleLinkSubmit}
            className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
          >
            <p className="text-sm font-medium text-gray-900">
              Vincular &quot;{linkingCategory.name}&quot; a:
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={targetDisciplineId}
                onChange={(e) => setTargetDisciplineId(e.target.value)}
                required
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
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
                className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {linkMutation.isPending ? "Salvando…" : "Vincular"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkingCategory(null);
                  setTargetDisciplineId("");
                }}
                className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
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
        <h2 className="text-lg font-medium text-gray-900">Itens de checklist</h2>
        <ul className="mt-4 space-y-2">
          {itemsForDiscipline.map((i) => (
            <li key={i.id} className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="font-medium text-gray-900">{i.description}</p>
              <p className="mt-1 text-xs text-gray-500">Peso: {i.weight} • Pontos máx: {i.maxPoints}</p>
            </li>
          ))}
          {itemsForDiscipline.length === 0 && <li className="text-sm text-gray-500">Nenhum item.</li>}
        </ul>
      </div>
    </Container>
  );
}
