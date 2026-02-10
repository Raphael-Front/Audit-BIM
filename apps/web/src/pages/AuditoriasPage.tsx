import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { api, type AuditListItem } from "@/lib/api";

export function AuditoriasPage() {
  const { data: auditorias = [] } = useQuery({
    queryKey: ["audits"],
    queryFn: () => api<AuditListItem[]>("/audits"),
  });
  const recent = (auditorias as AuditListItem[]).slice(0, 50);

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Auditorias</h1>
          <p className="text-sm text-gray-500">Planejamento e execução</p>
        </div>
        <Link
          to="/auditorias/new"
          className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Nova auditoria
        </Link>
      </div>
      <div className="mt-8 space-y-4">
        {recent.map((a) => (
          <Link
            key={a.id}
            to={`/auditorias/${a.id}`}
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm hover:border-blue-300"
          >
            <div>
              <p className="font-medium text-gray-900">{a.title ?? a.id}</p>
              <p className="text-sm text-gray-500">{a.startDate ?? "Sem data"}</p>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-medium text-gray-500">{a.status}</span>
          </Link>
        ))}
        {recent.length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma auditoria.</p>
        )}
      </div>
    </Container>
  );
}
