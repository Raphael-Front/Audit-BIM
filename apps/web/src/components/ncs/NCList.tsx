"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { auditUpdateItem } from "@/lib/api";
import { useState } from "react";

type Item = { id: string; descricao: string; observacoes?: string | null; construflow_id?: string | null };

export function NCList({ auditoriaId, initialItems }: { auditoriaId: string; initialItems: Item[] }) {
  const [local, setLocal] = useState<Record<string, string>>(
    () => Object.fromEntries(initialItems.map((i) => [i.id, i.construflow_id ?? ""]))
  );
  const queryClient = useQueryClient();

  const updateConstruflow = useMutation({
    mutationFn: async ({ itemId, construflowRef }: { itemId: string; construflowRef: string }) => {
      await auditUpdateItem(auditoriaId, itemId, { construflowRef: construflowRef || undefined });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-items", auditoriaId] }),
  });

  return (
    <ul className="mt-8 space-y-4">
      {initialItems.map((i) => (
        <li key={i.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
          <p className="font-medium text-[hsl(var(--foreground))]">{i.descricao}</p>
          {i.observacoes && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{i.observacoes}</p>}
          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Construflow ID</label>
            <input
              type="text"
              value={local[i.id] ?? ""}
              onChange={(e) => setLocal((prev) => ({ ...prev, [i.id]: e.target.value }))}
              onBlur={() => updateConstruflow.mutate({ itemId: i.id, construflowRef: local[i.id] ?? "" })}
              placeholder="ID do apontamento"
              className="flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
          </div>
        </li>
      ))}
      {initialItems.length === 0 && (
        <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma NC nesta auditoria.</li>
      )}
    </ul>
  );
}
