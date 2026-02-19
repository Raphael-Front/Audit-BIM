import { cookies } from "next/headers";
import { Container } from "@/components/layout/Container";
import Link from "next/link";
import { apiServer, type AuditListItem } from "@/lib/api";

export default async function AuditoriasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const auditorias: AuditListItem[] = token ? await apiServer<AuditListItem[]>("/audits", token).catch(() => []) : [];
  const recent = auditorias.slice(0, 50);

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[hsl(var(--macro))]">Auditorias</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Planejamento e execução</p>
        </div>
        <Link
          href="/auditorias/new"
          className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
        >
          Nova auditoria
        </Link>
      </div>
      <div className="mt-8 space-y-4">
        {recent.map((a) => (
          <Link
            key={a.id}
            href={`/auditorias/${a.id}`}
            className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-4 shadow-sm hover:border-[hsl(var(--ring))]"
          >
            <div>
              <p className="font-medium text-[hsl(var(--foreground))]">{a.title ?? a.id}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{a.startDate ?? "Sem data"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{a.status}</span>
            </div>
          </Link>
        ))}
        {recent.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria.</p>
        )}
      </div>
    </Container>
  );
}
