import { cookies } from "next/headers";
import { Container } from "@/components/layout/Container";
import Link from "next/link";
import { apiServer, type WorkRow } from "@/lib/api";

export default async function ObrasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const obras: WorkRow[] = token ? await apiServer<WorkRow[]>("/works", token).catch(() => []) : [];

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[hsl(var(--macro))]">Obras</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Gestão de obras</p>
        </div>
        <Link
          href="/obras/new"
          className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
        >
          Nova obra
        </Link>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {obras.map((o) => (
          <Link
            key={o.id}
            href={`/obras/${o.id}`}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm hover:border-[hsl(var(--ring))]"
          >
            <p className="font-medium text-[hsl(var(--foreground))]">{o.name}</p>
            {o.code && <p className="text-sm text-[hsl(var(--muted-foreground))]">{o.code}</p>}
            <span className="mt-2 inline-block rounded-full border px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{o.active ? "Ativa" : "Inativa"}</span>
          </Link>
        ))}
        {obras.length === 0 && (
          <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))]">Nenhuma obra cadastrada.</p>
        )}
      </div>
    </Container>
  );
}
