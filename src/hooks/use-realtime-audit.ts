"use client";

import { useEffect, useState } from "react";
import { auditGet, type AuditDetail } from "@/lib/api";

const POLL_MS = 5000;

export function useRealtimeAudit(auditoriaId: string | null) {
  const [audit, setAudit] = useState<AuditDetail | null>(null);

  useEffect(() => {
    if (!auditoriaId) return;
    const id: string = auditoriaId;
    let cancelled = false;
    function fetchAudit() {
      auditGet(id)
        .then((data) => {
          if (!cancelled) setAudit(data);
        })
        .catch(() => {});
    }
    fetchAudit();
    const interval = setInterval(fetchAudit, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [auditoriaId]);

  return audit;
}
