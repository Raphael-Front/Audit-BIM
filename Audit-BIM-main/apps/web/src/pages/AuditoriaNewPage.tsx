import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Container } from "@/components/layout/Container";
import {
  worksList,
  worksPhases,
  libraryDisciplines,
  libraryCategories,
  authMe,
  api,
  type WorkRow,
  type PhaseRow,
  type DisciplineRow,
  type CategoryRow,
} from "@/lib/api";

export function AuditoriaNewPage() {
  const [workId, setWorkId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    worksList().then(setWorks).catch(() => setWorks([]));
    libraryDisciplines().then(setDisciplines).catch(() => setDisciplines([]));
    authMe().then((u) => setAuditorId(u.id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!workId) {
      setPhases([]);
      setPhaseId("");
      return;
    }
    worksPhases(workId)
      .then(setPhases)
      .catch(() => setPhases([]));
    setPhaseId("");
  }, [workId]);

  useEffect(() => {
    if (!disciplineId) {
      setCategories([]);
      return;
    }
    libraryCategories(disciplineId).then(setCategories).catch(() => setCategories([]));
  }, [disciplineId]);

  // Auto-preenche o título (somente leitura): Código obra - Código disciplina - Código fase (ex: R15RV-EST-PB)
  useEffect(() => {
    if (!workId || !phaseId || !disciplineId) {
      setTitle("");
      return;
    }
    const work = works.find((w) => w.id === workId);
    const phase = phases.find((p) => p.id === phaseId);
    const discipline = disciplines.find((d) => d.id === disciplineId);
    if (!work || !phase || !discipline) return;
    const codeWork = (work.code ?? work.name).trim();
    const codeDiscipline = (discipline.code ?? discipline.name).trim();
    const codePhase = (phase.code ?? phase.name).trim();
    setTitle([codeWork, codeDiscipline, codePhase].filter(Boolean).join("-"));
  }, [workId, phaseId, disciplineId, works, phases, disciplines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!workId || !phaseId || !disciplineId || !auditorId) {
      setError("Preencha obra, fase da obra e disciplina.");
      return;
    }
    setLoading(true);
    try {
      const audit = await api<{ id: string }>("/audits", {
        method: "POST",
        body: JSON.stringify({
          workId,
          phaseId,
          disciplineId,
          title: title || `Auditoria ${startDate}`,
          startDate: new Date(startDate).toISOString(),
          auditorId,
        }),
      });
      navigate(`/auditorias/${audit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar auditoria");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <div className="mb-6">
        <Link to="/auditorias" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">← Auditorias</Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--macro))]">Nova auditoria</h1>
      <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="work" className="block text-sm font-medium text-[hsl(var(--foreground))]">Obra *</label>
          <select id="work" value={workId} onChange={(e) => setWorkId(e.target.value)} required className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2">
            <option value="">Selecione</option>
            {works.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="phase" className="block text-sm font-medium text-[hsl(var(--foreground))]">Fase da obra *</label>
          <select id="phase" value={phaseId} onChange={(e) => setPhaseId(e.target.value)} required className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2">
            <option value="">Selecione</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="discipline" className="block text-sm font-medium text-[hsl(var(--foreground))]">Disciplina *</label>
          <select id="discipline" value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} required className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2">
            <option value="">Selecione</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-[hsl(var(--foreground))]">Título</label>
          <input id="title" value={title} readOnly className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--muted))] px-3 py-2 cursor-not-allowed" placeholder="Preenchido automaticamente ao selecionar obra, fase e disciplina" />
        </div>
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-[hsl(var(--foreground))]">Data início *</label>
          <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50">Criar auditoria</button>
      </form>
    </Container>
  );
}
