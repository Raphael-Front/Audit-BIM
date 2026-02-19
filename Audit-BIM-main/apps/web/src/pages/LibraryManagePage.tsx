import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import {
  libraryDisciplines,
  libraryAllCategories,
  libraryAllChecklistItemsUnique,
  libraryAuditPhases,
  updateLibraryDiscipline,
  deleteLibraryDiscipline,
  updateLibraryCategory,
  deleteLibraryCategory,
  updateLibraryVerificationItem,
  deleteLibraryVerificationItem,
  createLibraryVerificationItemForCategory,
  moveLibraryVerificationItemToCategory,
  getItemDisciplines,
  getAllCategoryPhases,
  updateCategoryPhases,
  authMe,
  type DisciplineRow,
  type CategoryRow,
  type ChecklistItemWithCategory,
  type AuditPhaseRow,
} from "@/lib/api";

type TabType = "disciplines" | "categories" | "items" | "applicability";

export function LibraryManagePage() {
  const [activeTab, setActiveTab] = useState<TabType>("disciplines");
  const [editingDisciplineId, setEditingDisciplineId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemWeight, setEditItemWeight] = useState(1);
  const [editItemMaxPoints, setEditItemMaxPoints] = useState(1);
  const [editItemCategoryId, setEditItemCategoryId] = useState<string | null>(null);
  const [itemDisciplines, setItemDisciplines] = useState<{ id: string; name: string }[]>([]);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemWeight, setNewItemWeight] = useState(1);
  const [newItemMaxPoints, setNewItemMaxPoints] = useState(1);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [selectedCategoryForItem, setSelectedCategoryForItem] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authMe });
  const canEdit = me?.role === "admin_bim" || me?.role === "auditor_bim";

  const { data: disciplines = [] } = useQuery({
    queryKey: ["disciplines"],
    queryFn: libraryDisciplines,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["allCategories"],
    queryFn: libraryAllCategories,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["allChecklistItemsUnique"],
    queryFn: libraryAllChecklistItemsUnique,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
    enabled: activeTab === "items", // Só carregar quando necessário
  });

  const { data: auditPhases = [] } = useQuery({
    queryKey: ["auditPhases"],
    queryFn: libraryAuditPhases,
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos (fases mudam raramente)
  });

  // Estado para aplicabilidade categoria-fase
  const [categoryPhasesMap, setCategoryPhasesMap] = useState<Map<string, Set<string>>>(new Map());
  const [loadingPhases, setLoadingPhases] = useState<Set<string>>(new Set());
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [isEditingApplicability, setIsEditingApplicability] = useState(false);

  // Carregar aplicabilidades quando a aba de aplicabilidade estiver ativa (otimizado)
  useEffect(() => {
    if (activeTab === "applicability" && categories.length > 0) {
      const loadPhases = async () => {
        const categoryIds = categories.map((c) => c.id);
        setLoadingPhases(new Set(categoryIds));
        try {
          // Carregar todas as categorias de uma vez (muito mais rápido)
          const map = await getAllCategoryPhases(categoryIds);
          setCategoryPhasesMap(map);
        } catch (error) {
          console.error("Erro ao carregar fases das categorias:", error);
          // Em caso de erro, inicializar com map vazio
          const emptyMap = new Map<string, Set<string>>();
          for (const categoryId of categoryIds) {
            emptyMap.set(categoryId, new Set());
          }
          setCategoryPhasesMap(emptyMap);
        } finally {
          setLoadingPhases(new Set());
        }
      };
      loadPhases();
    } else if (activeTab !== "applicability") {
      // Limpar mapa quando sair da aba
      setCategoryPhasesMap(new Map());
    }
  }, [activeTab, categories]);

  const updateDisciplineMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateLibraryDiscipline(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplines"] });
      setEditingDisciplineId(null);
      setEditName("");
    },
  });

  const deleteDisciplineMutation = useMutation({
    mutationFn: (id: string) => deleteLibraryDiscipline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplines"] });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateLibraryCategory(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCategories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCategoryId(null);
      setEditName("");
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteLibraryCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCategories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      itemId,
      itemVerificacao,
      peso,
      pontosMaximo,
    }: {
      itemId: string;
      itemVerificacao: string;
      peso: number;
      pontosMaximo: number;
    }) => updateLibraryVerificationItem(itemId, { itemVerificacao, peso, pontosMaximo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allChecklistItemsUnique"] });
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] });
      setEditingItemId(null);
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: ({ itemId, newCategoryId }: { itemId: string; newCategoryId: string }) =>
      moveLibraryVerificationItemToCategory(itemId, newCategoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allChecklistItemsUnique"] });
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] });
      setEditingItemId(null);
      setEditItemCategoryId(null);
      setItemDisciplines([]);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteLibraryVerificationItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allChecklistItemsUnique"] });
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (categoryId: string) =>
      createLibraryVerificationItemForCategory({
        categoryId,
        itemVerificacao: newItemDescription.trim(),
        peso: newItemWeight,
        pontosMaximo: newItemMaxPoints,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allChecklistItemsUnique"] });
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] });
      setIsCreatingItem(false);
      setShowCategorySelection(false);
      setNewItemDescription("");
      setNewItemWeight(1);
      setNewItemMaxPoints(1);
      setSelectedCategoryForItem(null);
    },
  });

  function startEditDiscipline(discipline: DisciplineRow) {
    setEditingDisciplineId(discipline.id);
    setEditName(discipline.name);
  }

  function startEditCategory(category: CategoryRow) {
    setEditingCategoryId(category.id);
    setEditName(category.name);
  }

  async function startEditItem(item: ChecklistItemWithCategory) {
    setEditingItemId(item.id);
    setEditItemDescription(item.description);
    setEditItemWeight(item.weight);
    setEditItemMaxPoints(Math.round(item.maxPoints) || 1);
    setEditItemCategoryId(item.categoryId);
    
    // Buscar disciplinas vinculadas ao item
    try {
      const disciplines = await getItemDisciplines(item.id);
      setItemDisciplines(disciplines);
    } catch (error) {
      console.error("Erro ao buscar disciplinas:", error);
      setItemDisciplines([]);
    }
  }

  return (
    <Container>
      <div className="mb-6">
        <Link to="/templates" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--macro))]">
          ← Biblioteca
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--macro))]">Gerenciar Biblioteca</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Edite e exclua disciplinas, categorias e itens de verificação</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "disciplines" && (
            <Link
              to="/templates/new"
              className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
            >
              Nova disciplina
            </Link>
          )}
          {activeTab === "categories" && (
            <Link
              to="/categories/new"
              className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
            >
              Nova categoria
            </Link>
          )}
          {activeTab === "items" && !isCreatingItem && !showCategorySelection && (
            <button
              type="button"
              onClick={() => setIsCreatingItem(true)}
              className="rounded-xl bg-[hsl(var(--accent))] px-4 py-2 font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
            >
              Novo item
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-[hsl(var(--border))]">
        <nav className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("disciplines")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "disciplines"
                ? "border-[hsl(var(--macro))] text-[hsl(var(--macro))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Disciplinas ({disciplines.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "categories"
                ? "border-[hsl(var(--macro))] text-[hsl(var(--macro))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Categorias ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "items"
                ? "border-[hsl(var(--macro))] text-[hsl(var(--macro))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Itens de Verificação ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("applicability")}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "applicability"
                ? "border-[hsl(var(--macro))] text-[hsl(var(--macro))]"
                : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Aplicabilidade
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === "disciplines" && (
          <div className="space-y-4">
            {(disciplines as DisciplineRow[]).map((discipline) => (
              <div
                key={discipline.id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
              >
                {editingDisciplineId === discipline.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editName.trim()) {
                        updateDisciplineMutation.mutate({ id: discipline.id, name: editName.trim() });
                      }
                    }}
                    className="flex items-center gap-4"
                  >
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                    />
                    <button
                      type="submit"
                      disabled={updateDisciplineMutation.isPending}
                      className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDisciplineId(null);
                        setEditName("");
                      }}
                      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[hsl(var(--foreground))]">{discipline.name}</p>
                      {discipline.code && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Código: {discipline.code}</p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditDiscipline(discipline)}
                          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--macro))] hover:bg-[hsl(var(--muted))]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Tem certeza que deseja excluir a disciplina "${discipline.name}"? Ela será desativada e não aparecerá em novas auditorias.`
                              )
                            ) {
                              deleteDisciplineMutation.mutate(discipline.id);
                            }
                          }}
                          disabled={deleteDisciplineMutation.isPending}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {disciplines.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma disciplina cadastrada.</p>
            )}
          </div>
        )}

        {activeTab === "categories" && (
          <div className="space-y-4">
            {(categories as CategoryRow[]).map((category) => (
              <div
                key={category.id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
              >
                {editingCategoryId === category.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editName.trim()) {
                        updateCategoryMutation.mutate({ id: category.id, name: editName.trim() });
                      }
                    }}
                    className="flex items-center gap-4"
                  >
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                    />
                    <button
                      type="submit"
                      disabled={updateCategoryMutation.isPending}
                      className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(null);
                        setEditName("");
                      }}
                      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-[hsl(var(--foreground))]">{category.name}</p>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditCategory(category)}
                          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--macro))] hover:bg-[hsl(var(--muted))]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Tem certeza que deseja excluir a categoria "${category.name}"? Ela será desativada e não aparecerá em novas auditorias.`
                              )
                            ) {
                              deleteCategoryMutation.mutate(category.id);
                            }
                          }}
                          disabled={deleteCategoryMutation.isPending}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma categoria cadastrada.</p>
            )}
          </div>
        )}

        {activeTab === "items" && (
          <div className="space-y-4">
            {/* Formulário de criação de novo item */}
            {isCreatingItem && !showCategorySelection && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <h3 className="mb-4 text-lg font-medium text-[hsl(var(--foreground))]">Criar novo item de verificação</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newItemDescription.trim()) {
                      setShowCategorySelection(true);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                      Descrição *
                    </label>
                    <textarea
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      required
                      rows={3}
                      className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                      placeholder="Descreva o item de verificação..."
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                      Peso (1-5):
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={newItemWeight}
                        onChange={(e) => setNewItemWeight(parseInt(e.target.value, 10) || 1)}
                        className="w-16 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                      Pontos máx:
                      <input
                        type="number"
                        min={1}
                        value={newItemMaxPoints}
                        onChange={(e) => setNewItemMaxPoints(parseInt(e.target.value, 10) || 1)}
                        className="w-20 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!newItemDescription.trim()}
                      className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                    >
                      Próximo: Escolher categoria
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingItem(false);
                        setNewItemDescription("");
                        setNewItemWeight(1);
                        setNewItemMaxPoints(1);
                      }}
                      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Seleção de categoria */}
            {showCategorySelection && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <h3 className="mb-4 text-lg font-medium text-[hsl(var(--foreground))]">
                  Escolha a categoria para este item
                </h3>
                <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
                  O item será criado para todas as disciplinas vinculadas à categoria escolhida.
                </p>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {(categories as CategoryRow[]).map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryForItem(category.id)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selectedCategoryForItem === category.id
                          ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--accent))]"
                      }`}
                    >
                      <span className="font-medium text-[hsl(var(--foreground))]">{category.name}</span>
                    </button>
                  ))}
                </div>
                {categories.length === 0 && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma categoria disponível.</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCategoryForItem) {
                        createItemMutation.mutate(selectedCategoryForItem);
                      }
                    }}
                    disabled={!selectedCategoryForItem || createItemMutation.isPending}
                    className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                  >
                    {createItemMutation.isPending ? "Criando..." : "Criar item"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategorySelection(false);
                      setSelectedCategoryForItem(null);
                    }}
                    className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                  >
                    Voltar
                  </button>
                </div>
                {createItemMutation.isError && (
                  <p className="mt-2 text-sm text-red-600">{String(createItemMutation.error?.message)}</p>
                )}
              </div>
            )}

            {/* Lista de itens */}
            {(allItems as ChecklistItemWithCategory[]).map((item) => (
              <div
                key={`${item.categoryId}-${item.id}`}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
              >
                {editingItemId === item.id ? (
                  <div className="space-y-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editItemDescription.trim()) {
                          updateItemMutation.mutate({
                            itemId: item.id,
                            itemVerificacao: editItemDescription.trim(),
                            peso: editItemWeight,
                            pontosMaximo: editItemMaxPoints,
                          });
                        }
                      }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                          Descrição *
                        </label>
                        <textarea
                          value={editItemDescription}
                          onChange={(e) => setEditItemDescription(e.target.value)}
                          required
                          rows={3}
                          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                        />
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                          Peso:
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={editItemWeight}
                            onChange={(e) => setEditItemWeight(parseInt(e.target.value, 10) || 1)}
                            className="w-16 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                          Pontos máx:
                          <input
                            type="number"
                            min={1}
                            value={editItemMaxPoints}
                            onChange={(e) => setEditItemMaxPoints(parseInt(e.target.value, 10) || 1)}
                            className="w-20 rounded border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={updateItemMutation.isPending}
                          className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                        >
                          Salvar alterações
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(null);
                            setEditItemCategoryId(null);
                            setItemDisciplines([]);
                          }}
                          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>

                    {/* Informações da categoria e disciplinas atuais */}
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
                      <h4 className="mb-3 text-sm font-medium text-[hsl(var(--foreground))]">
                        Categoria e Disciplinas Atuais
                      </h4>
                      <div className="mb-3">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Categoria atual:</span>
                        <p className="font-medium text-[hsl(var(--foreground))]">{item.categoryName}</p>
                      </div>
                      {itemDisciplines.length > 0 && (
                        <div>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            Disciplinas vinculadas ({itemDisciplines.length}):
                          </span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {itemDisciplines.map((disc) => (
                              <span
                                key={disc.id}
                                className="inline-block rounded-md bg-[hsl(var(--card))] px-2 py-1 text-xs text-[hsl(var(--foreground))]"
                              >
                                {disc.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Seleção de nova categoria */}
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                      <h4 className="mb-3 text-sm font-medium text-[hsl(var(--foreground))]">
                        Mover para outra categoria
                      </h4>
                      <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
                        Selecione uma nova categoria. O item será movido para todas as disciplinas vinculadas à nova categoria.
                      </p>
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {(categories as CategoryRow[]).map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => setEditItemCategoryId(category.id)}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              editItemCategoryId === category.id
                                ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                                : category.id === item.categoryId
                                ? "border-[hsl(var(--border))] bg-[hsl(var(--muted))] opacity-60"
                                : "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--accent))]"
                            }`}
                            disabled={category.id === item.categoryId}
                          >
                            <span className="font-medium text-[hsl(var(--foreground))]">{category.name}</span>
                            {category.id === item.categoryId && (
                              <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">(atual)</span>
                            )}
                          </button>
                        ))}
                      </div>
                      {editItemCategoryId && editItemCategoryId !== item.categoryId && (
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              moveItemMutation.mutate({
                                itemId: item.id,
                                newCategoryId: editItemCategoryId,
                              });
                            }}
                            disabled={moveItemMutation.isPending}
                            className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                          >
                            {moveItemMutation.isPending ? "Movendo..." : "Mover item"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditItemCategoryId(null)}
                            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {moveItemMutation.isError && (
                        <p className="mt-2 text-sm text-red-600">{String(moveItemMutation.error?.message)}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-1">
                        <span className="inline-block rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          {item.categoryName}
                        </span>
                      </div>
                      <p className="font-medium text-[hsl(var(--foreground))]">{item.description}</p>
                      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                        Peso: {item.weight} • Pontos máx: {item.maxPoints}
                        {item.disciplineIds.length > 0 && (
                          <span className="ml-2">• {item.disciplineIds.length} disciplina(s)</span>
                        )}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditItem(item)}
                          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--macro))] hover:bg-[hsl(var(--muted))]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Tem certeza que deseja excluir este item de verificação? Ele será desativado e não aparecerá em novas auditorias."
                              )
                            ) {
                              deleteItemMutation.mutate(item.id);
                            }
                          }}
                          disabled={deleteItemMutation.isPending}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {allItems.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhum item de verificação cadastrado.</p>
            )}
          </div>
        )}

        {activeTab === "applicability" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">
                    Aplicabilidade de Categorias por Fase
                  </h3>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    {isEditingApplicability
                      ? "Clique no cadeado para bloquear a edição"
                      : "Clique no cadeado para desbloquear e editar"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingApplicability(!isEditingApplicability)}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                  title={isEditingApplicability ? "Bloquear edição" : "Desbloquear edição"}
                >
                  {isEditingApplicability ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Bloquear</span>
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <circle cx="12" cy="16" r="1" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </svg>
                      <span>Desbloquear</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
                Selecione quais fases cada categoria se aplica. Isso determina quais itens de verificação aparecerão ao criar auditorias.
              </p>

              {categories.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma categoria cadastrada.</p>
              ) : auditPhases.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhuma fase cadastrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-2 text-left text-sm font-medium text-[hsl(var(--foreground))]">
                          Categoria
                        </th>
                        {(auditPhases as AuditPhaseRow[]).map((phase) => (
                          <th
                            key={phase.id}
                            className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-center text-sm font-medium text-[hsl(var(--foreground))]"
                          >
                            {phase.label || phase.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(categories as CategoryRow[]).map((category) => {
                        const categoryPhases = categoryPhasesMap.get(category.id) || new Set<string>();
                        const isLoading = loadingPhases.has(category.id);
                        const isSaving = savingCategoryId === category.id;

                        return (
                          <tr key={category.id} className="hover:bg-[hsl(var(--muted))]/50">
                            <td className="border border-[hsl(var(--border))] px-4 py-3 text-sm font-medium text-[hsl(var(--foreground))]">
                              {category.name}
                            </td>
                            {(auditPhases as AuditPhaseRow[]).map((phase) => {
                              const isChecked = categoryPhases.has(phase.id);
                              return (
                                <td
                                  key={phase.id}
                                  className="border border-[hsl(var(--border))] px-3 py-3 text-center"
                                >
                                  {!isEditingApplicability ? (
                                    <div className="flex items-center justify-center">
                                      {isChecked ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[hsl(var(--muted-foreground))]">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      ) : (
                                        <div className="h-5 w-5 rounded border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))]" />
                                      )}
                                    </div>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const newPhases = new Set(categoryPhases);
                                        if (e.target.checked) {
                                          newPhases.add(phase.id);
                                        } else {
                                          newPhases.delete(phase.id);
                                        }

                                        // Atualizar estado local imediatamente
                                        setCategoryPhasesMap((prev) => {
                                          const newMap = new Map(prev);
                                          newMap.set(category.id, newPhases);
                                          return newMap;
                                        });

                                        // Salvar no servidor (async sem bloquear)
                                        setSavingCategoryId(category.id);
                                        updateCategoryPhases(category.id, Array.from(newPhases))
                                          .then(() => {
                                            queryClient.invalidateQueries({ queryKey: ["categoryPhases"] });
                                            queryClient.invalidateQueries({ queryKey: ["checklistItems"] });
                                          })
                                          .catch((error) => {
                                            console.error("Erro ao atualizar aplicabilidade:", error);
                                            // Reverter mudança em caso de erro
                                            setCategoryPhasesMap((prev) => {
                                              const newMap = new Map(prev);
                                              newMap.set(category.id, categoryPhases);
                                              return newMap;
                                            });
                                            alert(error instanceof Error ? error.message : "Erro ao atualizar aplicabilidade");
                                          })
                                          .finally(() => {
                                            setSavingCategoryId(null);
                                          });
                                      }}
                                      disabled={isSaving || !canEdit}
                                      className="h-4 w-4 rounded border-[hsl(var(--input))] text-[hsl(var(--accent))] focus:ring-[hsl(var(--ring))] disabled:opacity-50 cursor-pointer"
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {savingCategoryId && (
                <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Salvando alterações...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}

