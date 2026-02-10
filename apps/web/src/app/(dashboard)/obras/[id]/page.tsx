import { cookies } from "next/headers";
import { Container } from "@/components/layout/Container";
import { notFound } from "next/navigation";
import Link from "next/link";
import { apiServer, type WorkRow, type AuditListItem } from "@/lib/api";

export default async function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) notFound();
  const obra = await apiServer<WorkRow>(`/works/${id}`, token).catch(() => null);
  if (!obra) notFound();
  const audits = await apiServer<AuditListItem[]>(`/audits?workId=${id}`, token).catch(() => []);

  return (
    <Container>
      <div className="mb-6">
        <Link href="/obras" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">← Obras</Link>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">{obra.name}</h1>
        {obra.code && <p className="text-sm text-[hsl(var(--muted-foreground))]">{obra.code}</p>}
        <span className="mt-2 inline-block rounded-full border px-3 py-1 text-xs font-medium">{obra.active ? "Ativa" : "Inativa"}</span>
      </div>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Auditorias desta obra</h2>
        <ul className="mt-4 space-y-2">
          {audits.map((a) => (
            <li key={a.id}>
              <Link href={`/auditorias/${a.id}`} className="block rounded-xl border border-[hsl(var(--border))] px-4 py-2 font-medium hover:bg-[hsl(var(--muted))]">{a.title ?? a.id}</Link>
            </li>
          ))}
          {audits.length === 0 && <li className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma auditoria.</li>}
        </ul>
      </div>
    </Container>
  );
}
