import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { workGet, auditsList, type WorkRow, type AuditListItem } from "@/lib/api";

export function ObraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: obra, isError } = useQuery({
    queryKey: ["work", id],
    queryFn: () => workGet(id!),
    enabled: !!id,
  });
  const { data: audits = [] } = useQuery({
    queryKey: ["audits", id],
    queryFn: () => auditsList({ workId: id! }),
    enabled: !!id,
  });

  if (isError || (id && !obra)) {
    return (
      <Container>
        <p className="text-red-600">Obra não encontrada.</p>
        <Link to="/obras" className="mt-2 inline-block text-sm text-[hsl(var(--accent))]">← Obras</Link>
      </Container>
    );
  }

  if (!obra) return null;

  return (
    <Container>
      <div className="mb-6">
        <Link to="/obras" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">← Obras</Link>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[hsl(var(--macro))]">{(obra as WorkRow).name}</h1>
        {(obra as WorkRow).code && <p className="text-sm text-[hsl(var(--muted-foreground))]">{(obra as WorkRow).code}</p>}
        <span className="mt-2 inline-block rounded-full border px-3 py-1 text-xs font-medium">{(obra as WorkRow).active ? "Ativa" : "Inativa"}</span>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[hsl(var(--macro))]">Auditorias desta obra</h2>
        <ul className="mt-4 space-y-2">
          {(audits as AuditListItem[]).map((a) => (
            <li key={a.id}>
              <Link to={`/auditorias/${a.id}`} className="block rounded-xl border border-[hsl(var(--border))] px-4 py-2 font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">{a.title ?? a.id}</Link>
          </li>
        ))}
          {audits.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria.</li>}
        </ul>
      </div>
    </Container>
  );
}
