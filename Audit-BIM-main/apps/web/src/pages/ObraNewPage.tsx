import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { workCreate } from "@/lib/api";
import { Container } from "@/components/layout/Container";

export function ObraNewPage() {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await workCreate({ name: nome, code: codigo || null });
      navigate("/obras");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar obra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <div className="mb-6">
        <Link to="/obras" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">← Obras</Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--macro))]">Nova obra</h1>
      <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-[hsl(var(--foreground))]">Nome *</label>
          <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]" />
        </div>
        <div>
          <label htmlFor="codigo" className="block text-sm font-medium text-[hsl(var(--foreground))]">Código</label>
          <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50">Criar obra</button>
      </form>
    </Container>
  );
}
