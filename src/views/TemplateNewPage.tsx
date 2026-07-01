"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Container } from "@/components/layout/Container";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";

export function TemplateNewPage() {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/library/disciplines", {
        method: "POST",
        body: JSON.stringify({ name: nome.trim(), code: codigo.trim() || undefined, order: 0 }),
      });
      router.push("/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar disciplina");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <div className="mb-6">
        <Link href="/templates" className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">
        <NavArrowIcon direction="back" className="h-4 w-4" />
        Biblioteca
      </Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--macro))]">Nova disciplina</h1>
      <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="codigo" className="block text-sm font-medium text-[hsl(var(--foreground))]">Código</label>
          <input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ex: ARQ, AIT, EST"
            className="mt-1 w-full rounded-xl border-2 border-[hsl(var(--foreground))]/30 bg-white px-3 py-2.5 text-[hsl(var(--foreground))] shadow-[0_1px_4px_rgba(0,0,0,0.15)] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30"
          />
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Sigla exibida nas auditorias. Se vazio, é gerado a partir do nome.</p>
        </div>
        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-[hsl(var(--foreground))]">Nome *</label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Ex: Arquitetura, Arquitetura de Interiores"
            className="mt-1 w-full rounded-xl border-2 border-[hsl(var(--foreground))]/30 bg-white px-3 py-2.5 text-[hsl(var(--foreground))] shadow-[0_1px_4px_rgba(0,0,0,0.15)] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50">Criar disciplina</button>
      </form>
    </Container>
  );
}
