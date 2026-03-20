"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { NCList } from "@/components/ncs/NCList";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import { auditGet, auditItems, type AuditDetail, type AuditItemRow } from "@/lib/api";

export function NCsPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
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
        <Link href="/auditorias" className="mt-2 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--accent))]">
        <NavArrowIcon direction="back" className="h-4 w-4" />
        Voltar
      </Link>
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
        <Link href={`/auditorias/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">
        <NavArrowIcon direction="back" className="h-4 w-4" />
        Auditoria
      </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[hsl(var(--macro))]">Não conformidades</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Vincule o ID do Construflow a cada NC antes de concluir a auditoria.</p>
      <NCList auditoriaId={id!} initialItems={ncs} />
    </Container>
  );
}
