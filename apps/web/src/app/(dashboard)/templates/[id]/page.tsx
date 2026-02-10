import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { libraryDisciplines, libraryCategories, libraryChecklistItems, type DisciplineRow, type CategoryRow, type ChecklistItemRow } from "@/lib/api";

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  const discipline = (disciplines as DisciplineRow[]).find((d) => d.id === id);
  const categoryIds = (categories as CategoryRow[]).map((c) => c.id);
  const itemsForDiscipline = (checklistItems as ChecklistItemRow[]).filter((item) =>
    categoryIds.includes(item.categoryId)
  );

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
        <ul className="mt-4 space-y-2">
          {(categories as CategoryRow[]).map((c) => (
            <li key={c.id} className="rounded-xl border border-[hsl(var(--border))] px-4 py-2 font-medium text-[hsl(var(--foreground))]">{c.name}</li>
          ))}
          {categories.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma categoria.</li>}
        </ul>
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
