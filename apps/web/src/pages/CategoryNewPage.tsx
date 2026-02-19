import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { libraryDisciplines, libraryCreateCategoryWithDisciplines, libraryAuditPhases, createLibraryVerificationItem, type DisciplineRow, type AuditPhaseRow } from "@/lib/api";

interface VerificationItem {
  description: string;
  weight: number;
  maxPoints: number;
  auditPhaseIds: string[];
}

export function CategoryNewPage() {
  const [nome, setNome] = useState("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([
    { description: "", weight: 1, maxPoints: 1, auditPhaseIds: [] },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const { data: disciplines = [] } = useQuery({
    queryKey: ["disciplines"],
    queryFn: libraryDisciplines,
  });

  const { data: auditPhases = [] } = useQuery({
    queryKey: ["auditPhases"],
    queryFn: libraryAuditPhases,
  });

  function toggleDiscipline(disciplineId: string) {
    setSelectedDisciplines((prev) =>
      prev.includes(disciplineId) ? prev.filter((id) => id !== disciplineId) : [...prev, disciplineId]
    );
  }

  function addVerificationItem() {
    setVerificationItems((prev) => [...prev, { description: "", weight: 1, maxPoints: 1, auditPhaseIds: [] }]);
  }

  function removeVerificationItem(index: number) {
    setVerificationItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVerificationItem(index: number, field: keyof VerificationItem, value: string | number | string[]) {
    setVerificationItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function toggleAuditPhase(itemIndex: number, phaseId: string) {
    setVerificationItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              auditPhaseIds: item.auditPhaseIds.includes(phaseId)
                ? item.auditPhaseIds.filter((id) => id !== phaseId)
                : [...item.auditPhaseIds, phaseId],
            }
          : item
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!nome.trim()) {
      setError("O nome da categoria é obrigatório");
      return;
    }

    if (selectedDisciplines.length === 0) {
      setError("Selecione pelo menos uma disciplina");
      return;
    }

    // Validar itens de verificação
    const validItems = verificationItems.filter((item) => item.description.trim());
    if (validItems.length === 0) {
      setError("Adicione pelo menos um item de verificação");
      return;
    }

    for (const item of validItems) {
      if (!item.description.trim()) {
        setError("Todos os itens de verificação devem ter uma descrição");
        return;
      }
      if (item.weight < 1 || item.weight > 5) {
        setError("O peso deve estar entre 1 e 5");
        return;
      }
      if (item.maxPoints < 1) {
        setError("Os pontos máximos devem ser pelo menos 1");
        return;
      }
    }

    setLoading(true);
    try {
      // Criar categoria e vincular às disciplinas
      const category = await libraryCreateCategoryWithDisciplines({
        name: nome.trim(),
        disciplineIds: selectedDisciplines,
      });

      // Criar itens de verificação para cada disciplina selecionada
      for (const disciplineId of selectedDisciplines) {
        for (const item of validItems) {
          // Criar o item de verificação com as fases especificadas (ou todas se vazio)
          await createLibraryVerificationItem({
            disciplineId,
            categoryId: category.id,
            itemVerificacao: item.description.trim(),
            peso: item.weight,
            pontosMaximo: item.maxPoints,
            faseIds: item.auditPhaseIds.length > 0 ? item.auditPhaseIds : undefined, // Se vazio, vincula a todas
          });
        }
      }

      navigate("/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <div className="mb-6">
        <Link to="/templates" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">
          ← Biblioteca
        </Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--macro))]">Nova categoria</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Nome da categoria */}
        <div className="max-w-md space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Nome da categoria *
            </label>
            <input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
              placeholder="Ex: Documentação, Modelagem, Coordenação"
            />
          </div>
        </div>

        {/* Seleção de disciplinas */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
              Disciplinas * (selecione uma ou mais)
            </label>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {(disciplines as DisciplineRow[]).map((discipline) => (
                <label
                  key={discipline.id}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 cursor-pointer hover:border-[hsl(var(--accent))] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedDisciplines.includes(discipline.id)}
                    onChange={() => toggleDiscipline(discipline.id)}
                    className="rounded border-[hsl(var(--input))] text-[hsl(var(--accent))] focus:ring-[hsl(var(--ring))]"
                  />
                  <span className="text-sm text-[hsl(var(--foreground))]">{discipline.name}</span>
                </label>
              ))}
            </div>
            {selectedDisciplines.length === 0 && (
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Selecione pelo menos uma disciplina para vincular esta categoria
              </p>
            )}
          </div>
        </div>

        {/* Itens de verificação */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Itens de verificação desta categoria
            </label>
            <button
              type="button"
              onClick={addVerificationItem}
              className="text-sm text-[hsl(var(--macro))] hover:underline"
            >
              + Adicionar item
            </button>
          </div>

          <div className="space-y-6">
            {verificationItems.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-[hsl(var(--foreground))]">Item {index + 1}</h3>
                  {verificationItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVerificationItem(index)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                    Descrição *
                  </label>
                  <textarea
                    value={item.description}
                    onChange={(e) => updateVerificationItem(index, "description", e.target.value)}
                    required
                    rows={3}
                    className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                    placeholder="Descreva o item de verificação..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                      Peso (1-5) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={item.weight}
                      onChange={(e) => updateVerificationItem(index, "weight", parseInt(e.target.value) || 1)}
                      required
                      className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                      Pontos máximos *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.maxPoints}
                      onChange={(e) => updateVerificationItem(index, "maxPoints", parseInt(e.target.value) || 1)}
                      required
                      className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                    Fases de auditoria (opcional - deixe vazio para aplicar a todas)
                  </label>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {(auditPhases as AuditPhaseRow[]).map((phase) => (
                      <label
                        key={phase.id}
                        className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 cursor-pointer hover:border-[hsl(var(--accent))] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={item.auditPhaseIds.includes(phase.id)}
                          onChange={() => toggleAuditPhase(index, phase.id)}
                          className="rounded border-[hsl(var(--input))] text-[hsl(var(--accent))] focus:ring-[hsl(var(--ring))]"
                        />
                        <span className="text-sm text-[hsl(var(--foreground))]">{phase.name}</span>
                      </label>
                    ))}
                  </div>
                  {item.auditPhaseIds.length === 0 && (
                    <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                      Se nenhuma fase for selecionada, o item será aplicado a todas as fases
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[hsl(var(--accent))] px-6 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar categoria"}
          </button>
          <Link
            to="/templates"
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-6 py-2 font-medium text-[hsl(var(--foreground))] hover:opacity-90"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </Container>
  );
}

