import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { worksList, type WorkRow } from "@/lib/api";

export function ObrasPage() {
  const { data: obras = [] } = useQuery({
    queryKey: ["works"],
    queryFn: worksList,
  });

  return (
    <Container>
      <PageHeader
        title="Obras"
        subtitle="Gestão de obras"
        actions={
          <Link
            to="/obras/new"
            className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
          >
            Nova obra
          </Link>
        }
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(obras as WorkRow[]).map((o) => (
          <Link
            key={o.id}
            to={`/obras/${o.id}`}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm hover:border-[hsl(var(--accent))]"
          >
            <p className="font-medium text-[hsl(var(--foreground))]">{o.name}</p>
            {o.code && <p className="text-sm text-[hsl(var(--muted-foreground))]">{o.code}</p>}
            <span className="mt-2 inline-block rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{o.active ? "Ativa" : "Inativa"}</span>
          </Link>
        ))}
        {obras.length === 0 && (
          <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))]">Nenhuma obra cadastrada.</p>
        )}
      </div>
    </Container>
  );
}
