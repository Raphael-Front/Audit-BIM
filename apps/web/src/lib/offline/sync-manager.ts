/**
 * Gerenciador de sincronização para modo offline (PWA).
 * Em uma implementação completa: fila de mutações pendentes e flush quando online.
 */

const PENDING_KEY = "bim-audit-pending-sync";

export type PendingMutation = {
  id: string;
  table: string;
  op: "insert" | "update" | "upsert";
  payload: unknown;
  ts: number;
};

export function getPending(): PendingMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingMutation[]) : [];
  } catch {
    return [];
  }
}

export function addPending(m: Omit<PendingMutation, "id" | "ts">) {
  const list = getPending();
  list.push({
    ...m,
    id: crypto.randomUUID(),
    ts: Date.now(),
  });
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

export function removePending(id: string) {
  const list = getPending().filter((x) => x.id !== id);
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

export function clearPending() {
  localStorage.removeItem(PENDING_KEY);
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}
