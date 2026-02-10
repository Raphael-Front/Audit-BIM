import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { auditsList, type AuditListItem } from "@/lib/api";

const statusLabels: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  WAITING_FOR_ISSUES: "Aguardando apontamentos",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

export function AuditsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data: audits = [], isLoading, error } = useQuery({
    queryKey: ["audits", { status: statusFilter || undefined }],
    queryFn: () => auditsList({ status: statusFilter || undefined }),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (error) return <div className="p-6 text-red-600">{error instanceof Error ? error.message : "Erro ao carregar"}</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Auditorias</h1>
      <div className="mb-4 flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <ul className="space-y-3">
        {(audits as AuditListItem[]).map((a) => (
          <li key={a.id}>
            <Link
              to={`/audits/${a.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-900">{a.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-sm ${a.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : a.status === "WAITING_FOR_ISSUES" ? "bg-amber-100 text-amber-800" : a.status === "CANCELED" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-800"}`}>
                  {statusLabels[a.status] ?? a.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {[a.work?.name, a.phase?.name, a.discipline?.name, a.auditPhase?.label].filter(Boolean).join(" · ")}
                {a.auditor?.name && ` · ${a.auditor.name}`}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {audits.length === 0 && <p className="text-gray-500">Nenhuma auditoria encontrada.</p>}
    </div>
  );
}
