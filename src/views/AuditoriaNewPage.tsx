"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { NavArrowIcon } from "@/components/ui/NavArrowIcon";
import {
  ClipboardCheck,
  Building2,
  Layers,
  BookOpen,
  FileText,
  Calendar,
  User,
} from "lucide-react";
import {
  worksList,
  worksPhases,
  libraryDisciplines,
  libraryCategories,
  api,
  type WorkRow,
  type PhaseRow,
  type DisciplineRow,
  type CategoryRow,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const inputBase =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 pl-10 text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent";
const inputReadonly =
  "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2.5 pl-10 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] cursor-not-allowed";

function FieldWithIcon({
  id,
  label,
  icon: Icon,
  required,
  children,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[hsl(var(--foreground))]">
        {label} {required && "*"}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        {children}
      </div>
    </div>
  );
}

export function AuditoriaNewPage() {
  const { me } = useAuth();
  const [workId, setWorkId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [auditorId, setAuditorId] = useState(me?.id ?? "");
  const [auditorName, setAuditorName] = useState(me?.name || me?.email || "");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSchedule = searchParams.get("schedule") === "1";

  useEffect(() => {
    if (me && !auditorId) {
      setAuditorId(me.id);
      setAuditorName(me.name || me.email || "");
    }
  }, [me]);

  useEffect(() => {
    worksList().then(setWorks).catch(() => setWorks([]));
    libraryDisciplines().then(setDisciplines).catch(() => setDisciplines([]));
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
          startDate: startDate,
          endDate: endDate || undefined,
          auditorId,
          scheduled: isSchedule,
        }),
      });
      router.push(`/auditorias/${audit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar auditoria");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <div className="mb-6">
        <Link
          href="/auditorias"
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]"
        >
          <NavArrowIcon direction="back" className="h-4 w-4" />
          Auditorias
        </Link>
      </div>

      <div className="mx-auto w-full max-w-6xl rounded-xl border border-[hsl(var(--border))] bg-white p-8 shadow-md dark:bg-[hsl(var(--card))]">
        {/* Cabeçalho do formulário */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))]/10">
            <ClipboardCheck className="h-6 w-6 text-[hsl(var(--accent))]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
              {isSchedule ? "Agendar nova auditoria" : "Nova auditoria"}
            </h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {isSchedule
                ? "Preencha os dados abaixo para agendar uma auditoria BIM. A auditoria ficará com status Agendado e aparecerá no card de Próxima data de auditoria do dashboard."
                : "Preencha os dados abaixo para iniciar uma nova auditoria BIM."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Grid 2 colunas */}
          <div className="grid gap-6 sm:grid-cols-2">
            <FieldWithIcon id="work" label="Obra" icon={Building2} required>
              <select
                id="work"
                value={workId}
                onChange={(e) => setWorkId(e.target.value)}
                required
                className={inputBase}
              >
                <option value="">Selecione</option>
                {works.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </FieldWithIcon>

            <FieldWithIcon id="phase" label="Fase da obra" icon={Layers} required>
              <select
                id="phase"
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                required
                className={inputBase}
              >
                <option value="">Selecione</option>
                {phases
                  .filter((p) => (p.name || "").toLowerCase() !== "geral")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </FieldWithIcon>

            <FieldWithIcon id="discipline" label="Disciplina" icon={BookOpen} required>
              <select
                id="discipline"
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                required
                className={inputBase}
              >
                <option value="">Selecione</option>
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FieldWithIcon>

            <FieldWithIcon id="title" label="Título" icon={FileText}>
              <input
                id="title"
                value={title}
                readOnly
                className={inputReadonly}
                placeholder="Preenchido automaticamente ao selecionar obra, fase e disciplina"
              />
            </FieldWithIcon>

            <FieldWithIcon id="startDate" label="Data início" icon={Calendar} required>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className={inputBase}
              />
            </FieldWithIcon>

            <FieldWithIcon id="endDate" label="Data fim" icon={Calendar}>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputBase}
              />
            </FieldWithIcon>
          </div>

          {/* Seção Responsável pela auditoria */}
          <div className="mt-8 border-t border-[hsl(var(--border))] pt-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Responsável pela auditoria
            </h3>
            <FieldWithIcon id="auditor" label="Responsável pela auditoria" icon={User}>
              <input
                id="auditor"
                type="text"
                value={auditorName}
                readOnly
                className={inputReadonly}
                placeholder="Usuário logado"
              />
            </FieldWithIcon>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {/* Footer do formulário */}
          <div className="mt-8 flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-6">
            <Link
              href="/auditorias"
              className="rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2.5 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (isSchedule ? "Agendando…" : "Criando…") : (isSchedule ? "Agendar auditoria" : "Criar auditoria")}
            </button>
          </div>
        </form>
      </div>
    </Container>
  );
}
