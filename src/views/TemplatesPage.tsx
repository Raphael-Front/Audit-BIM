"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Info } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { libraryDisciplines, getPermissionsConfig, type DisciplineRow } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function TemplatesPage() {
  const { data: disciplines = [] } = useQuery({ queryKey: ["disciplines"], queryFn: libraryDisciplines });
  const { me } = useAuth();
  const config = getPermissionsConfig();
  const canManage = me ? (config[me.role as keyof typeof config]?.permissions ?? []).includes("biblioteca_manage") : false;

  return (
    <Container>
      <PageHeader
        title="Biblioteca"
        subtitle="Disciplinas, categorias e itens de checklist"
        actions={
          canManage ? (
            <Link
              href="/library/manage"
              className="rounded-lg border border-[var(--color-text-secondary)] bg-transparent px-4 py-2 font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] transition-all duration-150 flex items-center gap-2"
              title="Gerenciar biblioteca"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Gerenciar
            </Link>
          ) : undefined
        }
      />
      <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
        <Info className="size-4 shrink-0" />
        A Biblioteca é compartilhada entre todas as obras.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(disciplines as DisciplineRow[]).map((d) => (
          <Link
            key={d.id}
            href={`/templates/${d.id}`}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-150 group"
          >
            <p className="font-medium text-[var(--color-text-primary)] flex items-center justify-between">
              {d.name}
              <span className="opacity-0 group-hover:opacity-100 text-[var(--color-accent)] transition-opacity">→</span>
            </p>
          </Link>
        ))}
        {disciplines.length === 0 && (
          <p className="col-span-full text-sm text-[hsl(var(--muted-foreground))]">Nenhuma disciplina cadastrada.</p>
        )}
      </div>
    </Container>
  );
}
