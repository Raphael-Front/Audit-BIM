"use client";

import { useEffect, useState } from "react";
import { auditItems, type AuditItemRow } from "@/lib/api";

const POLL_MS = 5000;

export function useRealtimeItems(auditoriaId: string | null) {
  const [items, setItems] = useState<AuditItemRow[]>([]);

  useEffect(() => {
    if (!auditoriaId) return;
    let cancelled = false;
    function fetchItems() {
      auditItems(auditoriaId)
        .then((data) => {
          if (!cancelled) setItems(data);
        })
        .catch(() => {});
    }
    fetchItems();
    const interval = setInterval(fetchItems, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [auditoriaId]);

  return items;
}
