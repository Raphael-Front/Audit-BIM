"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { workCreate } from "@/lib/api";
import { Container } from "@/components/layout/Container";
import Link from "next/link";

export default function NewObraPage() {
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
      await workCreate({ name: nome, code: codigo || null });
      router.push("/obras");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar obra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <div className="mb-6">
        <Link href="/obras" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">← Obras</Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))]">Nova obra</h1>
      <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-[hsl(var(--foreground))]">Nome *</label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Ex: Edifício Central"
            className="mt-1 w-full rounded-xl border-2 border-[hsl(var(--foreground))]/30 bg-white px-3 py-2.5 text-[hsl(var(--foreground))] shadow-[0_1px_4px_rgba(0,0,0,0.15)] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30"
          />
        </div>
        <div>
          <label htmlFor="codigo" className="block text-sm font-medium text-[hsl(var(--foreground))]">Código</label>
          <input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ex: OB-001"
            className="mt-1 w-full rounded-xl border-2 border-[hsl(var(--foreground))]/30 bg-white px-3 py-2.5 text-[hsl(var(--foreground))] shadow-[0_1px_4px_rgba(0,0,0,0.15)] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/30"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50">Criar obra</button>
      </form>
    </Container>
  );
}
