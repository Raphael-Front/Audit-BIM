"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { worksList, type WorkRow } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/** "all" = Todas as obras (visão consolidada) | <id da obra> */
export type ObraSelection = "all" | string;

type ObraContextValue = {
  /** "all" ou o id da obra selecionada */
  selection: ObraSelection;
  /** id da obra selecionada, ou null quando "Todas as obras" (use direto como filters.workId) */
  selectedObraId: string | null;
  setSelection: (s: ObraSelection) => void;
  obras: WorkRow[];
  selectedObra: WorkRow | null;
  isAll: boolean;
  isLoading: boolean;
};

const ObraContext = createContext<ObraContextValue | null>(null);

const STORAGE_PREFIX = "auditbim:selectedObra:";

export function ObraProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const userId = user?.id ?? null;
  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ["works-list"],
    queryFn: () => worksList(),
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
  });

  // Padrão: "Todas as obras"
  const [selection, setSelectionState] = useState<ObraSelection>("all");

  // Restaura a seleção salva quando o usuário é conhecido
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      setSelectionState(saved ? (saved as ObraSelection) : "all");
    } catch {
      setSelectionState("all");
    }
  }, [storageKey]);

  // Se a obra salva não existe mais (excluída/inativa), volta para "Todas as obras"
  useEffect(() => {
    if (selection === "all" || isLoading || obras.length === 0) return;
    if (!obras.some((o) => o.id === selection)) {
      setSelectionState("all");
      if (storageKey) {
        try { localStorage.setItem(storageKey, "all"); } catch { /* ignore */ }
      }
    }
  }, [selection, obras, isLoading, storageKey]);

  const setSelection = useCallback(
    (s: ObraSelection) => {
      setSelectionState(s);
      if (storageKey) {
        try { localStorage.setItem(storageKey, s); } catch { /* ignore */ }
      }
    },
    [storageKey],
  );

  const value = useMemo<ObraContextValue>(() => {
    const isAll = selection === "all";
    const selectedObra = isAll ? null : obras.find((o) => o.id === selection) ?? null;
    return {
      selection,
      selectedObraId: isAll ? null : selection,
      setSelection,
      obras,
      selectedObra,
      isAll,
      isLoading,
    };
  }, [selection, obras, isLoading, setSelection]);

  return <ObraContext.Provider value={value}>{children}</ObraContext.Provider>;
}

export function useObra() {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error("useObra must be used within ObraProvider");
  return ctx;
}
