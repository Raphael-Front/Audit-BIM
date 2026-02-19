import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Container } from "@/components/layout/Container";
import { libraryDisciplines, type DisciplineRow } from "@/lib/api";

export default function TemplatesPage() {
  const { data: disciplines = [] } = useQuery({ queryKey: ["disciplines"], queryFn: libraryDisciplines });

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[hsl(var(--macro))]">Biblioteca</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Disciplinas, categorias e itens de checklist</p>
        </div>
        <Link
          to="/templates/new"
          className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
        >
          Nova disciplina
        </Link>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(disciplines as DisciplineRow[]).map((d) => (
          <Link
            key={d.id}
            to={`/templates/${d.id}`}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm hover:border-[hsl(var(--ring))]"
          >
            <p className="font-medium text-[hsl(var(--foreground))]">{d.name}</p>
          </Link>
        ))}
        {disciplines.length === 0 && (
          <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))]">Nenhuma disciplina cadastrada.</p>
        )}
      </div>
    </Container>
  );
}
