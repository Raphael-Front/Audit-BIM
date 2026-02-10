import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { worksList, type WorkRow } from "@/lib/api";

export function ObrasPage() {
  const { data: obras = [] } = useQuery({
    queryKey: ["works"],
    queryFn: worksList,
  });

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Obras</h1>
          <p className="text-sm text-gray-500">Gestão de obras</p>
        </div>
        <Link
          to="/obras/new"
          className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Nova obra
        </Link>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(obras as WorkRow[]).map((o) => (
          <Link
            key={o.id}
            to={`/obras/${o.id}`}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-blue-300"
          >
            <p className="font-medium text-gray-900">{o.name}</p>
            {o.code && <p className="text-sm text-gray-500">{o.code}</p>}
            <span className="mt-2 inline-block rounded-full border px-3 py-1 text-xs font-medium text-gray-500">{o.active ? "Ativa" : "Inativa"}</span>
          </Link>
        ))}
        {obras.length === 0 && (
          <p className="col-span-full text-sm text-gray-500">Nenhuma obra cadastrada.</p>
        )}
      </div>
    </Container>
  );
}
