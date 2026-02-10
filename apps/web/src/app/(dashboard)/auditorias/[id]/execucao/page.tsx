import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { useState, useEffect } from "react";
import { auditItems, auditUpdateItem, type AuditItemRow } from "@/lib/api";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "NOT_STARTED", label: "Pendente" },
  { value: "CONFORMING", label: "Conforme" },
  { value: "NONCONFORMING", label: "Não conforme" },
  { value: "OBSERVATION", label: "Observação" },
  { value: "NA", label: "N/A" },
];

export default function ExecucaoPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [evidenceText, setEvidenceText] = useState<Record<string, string>>({});
  const [construflowRef, setConstruflowRef] = useState<Record<string, string>>({});

  const { data: itens, isLoading } = useQuery({
    queryKey: ["audit-items", id],
    queryFn: () => auditItems(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!itens) return;
    const ev: Record<string, string> = {};
    const cf: Record<string, string> = {};
    itens.forEach((i) => {
      ev[i.id] = i.evidenceText ?? "";
      cf[i.id] = i.construflowRef ?? "";
    });
    setEvidenceText(ev);
    setConstruflowRef(cf);
  }, [itens]);

  const updateItem = useMutation({
    mutationFn: async ({ itemId, status, evidenceText: ev, construflowRef: cf }: { itemId: string; status?: string; evidenceText?: string; construflowRef?: string }) => {
      await auditUpdateItem(id!, itemId, { status, evidenceText: ev, construflowRef: cf });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-items", id] }),
  });

  function handleStatusChange(itemId: string, status: string) {
    updateItem.mutate({ itemId, status, evidenceText: evidenceText[itemId], construflowRef: construflowRef[itemId] || undefined });
  }

  function handleBlur(itemId: string) {
    const item = itens?.find((i) => i.id === itemId);
    if (!item) return;
    if (evidenceText[itemId] !== (item.evidenceText ?? "") || construflowRef[itemId] !== (item.construflowRef ?? "")) {
      updateItem.mutate({
        itemId,
        evidenceText: evidenceText[itemId],
        construflowRef: construflowRef[itemId] || undefined,
      });
    }
  }

  function description(item: AuditItemRow): string {
    return item.checklistItem?.description ?? item.customItem?.description ?? item.id;
  }

  if (isLoading || !itens) {
    return (
      <Container>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando…</p>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-6 flex items-center justify-between">
        <Link to={`/auditorias/${id}`} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">← Auditoria</Link>
      </div>
      <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Execução</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Avalie cada item e salve. Alterações são persistidas automaticamente.</p>
      <div className="mt-8 space-y-6">
        {itens.map((i) => (
          <div key={i.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[hsl(var(--foreground))]">{description(i)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${i.status === "CONFORMING" ? "bg-emerald-600 text-white" : i.status === "NONCONFORMING" ? "bg-red-600 text-white" : i.status === "NA" ? "bg-zinc-400 text-black" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>{i.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusChange(i.id, opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${i.status === opt.value ? "border-[hsl(var(--ring))] bg-[hsl(var(--muted))]" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-[hsl(var(--foreground))]">Evidência / Observações</label>
              <textarea
                value={evidenceText[i.id] ?? ""}
                onChange={(e) => setEvidenceText((prev) => ({ ...prev, [i.id]: e.target.value }))}
                onBlur={() => handleBlur(i.id)}
                rows={2}
                className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
              />
              {i.status === "NONCONFORMING" && (
                <>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))]">Construflow ID</label>
                  <input
                    type="text"
                    value={construflowRef[i.id] ?? ""}
                    onChange={(e) => setConstruflowRef((prev) => ({ ...prev, [i.id]: e.target.value }))}
                    onBlur={() => handleBlur(i.id)}
                    placeholder="ID do apontamento"
                    className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
