import { cookies } from "next/headers";
import { Container } from "@/components/layout/Container";
import Link from "next/link";
import { apiServer, type AuditListItem } from "@/lib/api";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const works = token ? await apiServer<{ id: string }[]>("/works", token).catch(() => []) : [];
  const audits = token ? await apiServer<AuditListItem[]>("/audits", token).catch(() => []) : [];
  const recent = audits.slice(0, 5);

  return (
    <Container>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[hsl(var(--macro))]">Dashboard</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Visão geral do sistema</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Obras</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">{works.length}</p>
            <Link href="/obras" className="mt-2 inline-block text-sm font-medium text-[hsl(var(--accent))] hover:opacity-90">Ver obras</Link>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Auditorias</p>
            <p className="text-2xl font-semibold text-[hsl(var(--foreground))]">{audits.length}</p>
            <Link href="/auditorias" className="mt-2 inline-block text-sm font-medium text-[hsl(var(--accent))] hover:opacity-90">Ver auditorias</Link>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Templates</p>
            <Link href="/templates" className="mt-2 inline-block text-sm font-medium text-[hsl(var(--accent))] hover:opacity-90">Biblioteca</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
          <h2 className="text-lg font-medium text-[hsl(var(--macro))]">Auditorias recentes</h2>
          <ul className="mt-4 space-y-2">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-2">
                <Link href={`/auditorias/${a.id}`} className="font-medium text-[hsl(var(--foreground))] hover:underline">{a.title ?? a.id}</Link>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{a.status}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria ainda.</li>}
          </ul>
        </div>
      </div>
    </Container>
  );
}
