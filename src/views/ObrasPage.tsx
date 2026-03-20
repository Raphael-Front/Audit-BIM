"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { worksList, getPermissionsConfig, type WorkRow } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function ObrasPage() {
  const { data: obras = [] } = useQuery({
    queryKey: ["works"],
    queryFn: worksList,
  });
  const { me } = useAuth();
  const config = getPermissionsConfig();
  const canCreate = me ? (config[me.role as keyof typeof config]?.permissions ?? []).includes("obras_new") : false;

  return (
    <Container>
      <PageHeader
        title="Obras"
        subtitle="Gestão de obras"
        actions={
          canCreate ? (
            <Link
              href="/obras/new"
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white hover:opacity-90 transition-all duration-150"
            >
              Nova obra
            </Link>
          ) : undefined
        }
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(obras as WorkRow[]).map((o) => (
          <Link
            key={o.id}
            href={`/obras/${o.id}`}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-lg hover:border-[var(--color-accent)] hover:bg-gradient-to-br hover:from-[var(--color-surface)] hover:to-[var(--color-accent-soft)] transition-all duration-150"
          >
            <p className="text-base font-bold text-[var(--color-primary)]" style={{ fontFamily: "var(--font-display)" }}>{o.name}</p>
            {o.code && <p className="text-sm text-[var(--color-text-muted)]">{o.code}</p>}
            <span className={`mt-2 inline-block rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold ${o.active ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : "bg-[var(--color-bg)] text-[var(--color-text-muted)]"}`}>{o.active ? "Ativa" : "Inativa"}</span>
          </Link>
        ))}
        {obras.length === 0 && (
          <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))]">Nenhuma obra cadastrada.</p>
        )}
      </div>
    </Container>
  );
}
