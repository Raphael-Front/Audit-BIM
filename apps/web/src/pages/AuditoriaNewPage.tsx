import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Container } from "@/components/layout/Container";
import {
  worksList,
  worksPhases,
  libraryDisciplines,
  libraryAuditPhases,
  libraryCategories,
  authMe,
  api,
  type WorkRow,
  type AuditPhaseRow,
  type DisciplineRow,
  type CategoryRow,
} from "@/lib/api";

export function AuditoriaNewPage() {
  const [workId, setWorkId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [auditPhaseId, setAuditPhaseId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [phases, setPhases] = useState<{ id: string; name: string }[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [auditPhases, setAuditPhases] = useState<AuditPhaseRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    worksList().then(setWorks).catch(() => setWorks([]));
    libraryDisciplines().then(setDisciplines).catch(() => setDisciplines([]));
    libraryAuditPhases().then(setAuditPhases).catch(() => setAuditPhases([]));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!workId || !phaseId || !disciplineId || !auditPhaseId || !auditorId) {
      setError("Preencha obra, fase, disciplina, fase de auditoria.");
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
          auditPhaseId,
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
        <Link to="/auditorias" className="text-sm text-gray-500 hover:text-gray-900">← Auditorias</Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Nova auditoria</h1>
      <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="work" className="block text-sm font-medium text-gray-700">Obra *</label>
          <select id="work" value={workId} onChange={(e) => setWorkId(e.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2">
            <option value="">Selecione</option>
            {works.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="phase" className="block text-sm font-medium text-gray-700">Fase da obra *</label>
          <select id="phase" value={phaseId} onChange={(e) => setPhaseId(e.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2">
            <option value="">Selecione</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="discipline" className="block text-sm font-medium text-gray-700">Disciplina *</label>
          <select id="discipline" value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2">
            <option value="">Selecione</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="auditPhase" className="block text-sm font-medium text-gray-700">Fase de auditoria (PL, LO, etc.) *</label>
          <select id="auditPhase" value={auditPhaseId} onChange={(e) => setAuditPhaseId(e.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2">
            <option value="">Selecione</option>
            {auditPhases.map((a) => (
              <option key={a.id} value={a.id}>{a.name} - {a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Título</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" placeholder="Ex.: Auditoria PL - Estrutura" />
        </div>
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Data início *</label>
          <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50">Criar auditoria</button>
      </form>
    </Container>
  );
}
