import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { NCList } from "@/components/ncs/NCList";
import { auditGet, auditItems, type AuditDetail, type AuditItemRow } from "@/lib/api";

export function NCsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: audit, isError } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => auditGet(id!),
    enabled: !!id,
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["audit-items", id],
    queryFn: () => auditItems(id!),
    enabled: !!id,
  });

  if (isError || (id && !audit)) {
    return (
      <Container>
        <p className="text-red-600">Auditoria não encontrada.</p>
        <Link to="/auditorias" className="mt-2 inline-block text-sm text-[hsl(var(--accent))]">← Voltar</Link>
      </Container>
    );
  }

  const ncs = (itens as AuditItemRow[])
    .filter((i) => i.status === "NONCONFORMING")
    .map((i) => ({
      id: i.id,
      descricao: i.checklistItem?.description ?? i.customItem?.description ?? i.id,
      observacoes: i.evidenceText ?? "",
      construflow_id: i.construflowRef ?? "",
      anexos: i.anexos ?? [],
    }));

  return (
    <Container>
      <div className="mb-6">
        <Link to={`/auditorias/${id}`} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">← Auditoria</Link>
      </div>
      <h1 className="text-2xl font-semibold text-[hsl(var(--macro))]">Não conformidades</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Vincule o ID do Construflow a cada NC antes de concluir a auditoria.</p>
      <NCList auditoriaId={id!} initialItems={ncs} />
    </Container>
  );
}
