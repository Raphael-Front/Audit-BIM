import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Container } from "@/components/layout/Container";
import { libraryDisciplines, type DisciplineRow } from "@/lib/api";

export function TemplatesPage() {
  const { data: disciplines = [] } = useQuery({ queryKey: ["disciplines"], queryFn: libraryDisciplines });

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Biblioteca</h1>
          <p className="text-sm text-gray-500">Disciplinas, categorias e itens de checklist</p>
        </div>
        <Link
          to="/templates/new"
          className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Nova disciplina
        </Link>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(disciplines as DisciplineRow[]).map((d) => (
          <Link
            key={d.id}
            to={`/templates/${d.id}`}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-blue-300"
          >
            <p className="font-medium text-gray-900">{d.name}</p>
            <p className="mt-2 text-xs text-gray-500">Ordem: {d.order}</p>
          </Link>
        ))}
        {disciplines.length === 0 && (
          <p className="col-span-full text-sm text-gray-500">Nenhuma disciplina cadastrada.</p>
        )}
      </div>
    </Container>
  );
}
