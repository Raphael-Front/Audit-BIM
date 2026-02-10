import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { api, type AuditListItem } from "@/lib/api";

export function DashboardPage() {
  const { data: works = [] } = useQuery({
    queryKey: ["works"],
    queryFn: () => api<{ id: string }[]>("/works"),
  });
  const { data: audits = [] } = useQuery({
    queryKey: ["audits"],
    queryFn: () => api<AuditListItem[]>("/audits"),
  });
  const recent = (audits as AuditListItem[]).slice(0, 5);

  return (
    <Container>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Visão geral do sistema</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Obras</p>
            <p className="text-2xl font-semibold text-gray-900">{works.length}</p>
            <Link to="/obras" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:opacity-90">Ver obras</Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Auditorias</p>
            <p className="text-2xl font-semibold text-gray-900">{audits.length}</p>
            <Link to="/auditorias" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:opacity-90">Ver auditorias</Link>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Templates</p>
            <Link to="/templates" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:opacity-90">Biblioteca</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900">Auditorias recentes</h2>
          <ul className="mt-4 space-y-2">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2">
                <Link to={`/auditorias/${a.id}`} className="font-medium text-gray-900 hover:underline">{a.title ?? a.id}</Link>
                <span className="text-sm text-gray-500">{a.status}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="text-sm text-gray-500">Nenhuma auditoria ainda.</li>}
          </ul>
        </div>
      </div>
    </Container>
  );
}
