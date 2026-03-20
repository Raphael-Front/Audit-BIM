"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listUsers,
  updateUserRole,
  resendConfirmationEmail,
  logActivityAsync,
  PERMISSIONS_INFO,
  AVAILABLE_SCREENS,
  getPermissionsConfig,
  savePermissionsConfig,
  type UserRow,
  type PermissionInfo,
  type ScreenId,
} from "@/lib/api";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useAuth } from "@/contexts/AuthContext";

export function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { me } = useAuth();
  const isAdmin = me?.role === "admin_bim";

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
    retry: 2,
  });

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin_bim" | "auditor_bim" | "leitor">("auditor_bim");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin_bim" | "auditor_bim" | "leitor">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  
  // Estado para permissões editáveis (agora baseadas em telas)
  const [permissionsConfig, setPermissionsConfig] = useState<Record<"admin_bim" | "auditor_bim" | "leitor", PermissionInfo>>(
    () => getPermissionsConfig()
  );
  const [editingPermissions, setEditingPermissions] = useState<"admin_bim" | "auditor_bim" | "leitor" | null>(null);
  const [selectedScreens, setSelectedScreens] = useState<Set<ScreenId>>(new Set());

  // Carregar permissões ao montar o componente
  useEffect(() => {
    setPermissionsConfig(getPermissionsConfig());
  }, []);

  // Filtrar usuários
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Filtro por perfil
    if (filterRole !== "all") {
      filtered = filtered.filter((u) => u.perfil === filterRole);
    }

    // Filtro por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.nomeCompleto.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          PERMISSIONS_INFO[u.perfil].label.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [users, filterRole, searchTerm]);

  // Contar usuários por perfil
  const userCounts = useMemo(() => {
    return {
      all: users.length,
      admin_bim: users.filter((u) => u.perfil === "admin_bim").length,
      auditor_bim: users.filter((u) => u.perfil === "auditor_bim").length,
      leitor: users.filter((u) => u.perfil === "leitor").length,
    };
  }, [users]);

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin_bim" | "auditor_bim" | "leitor" }) =>
      updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUserId(null);
      toast.success("Permissão atualizada com sucesso!");
    },
  });

  function startEditUser(user: UserRow) {
    setEditingUserId(user.id);
    setSelectedRole(user.perfil);
  }

  return (
    <Container>
      <PageHeader
        title="Configurações"
        subtitle={isAdmin ? "Gerenciamento do sistema e preferências" : "Preferências da aplicação"}
      />

      {/* Log de Atividades (Admin only) */}
      {isAdmin && (
        <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Log de Atividades</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Histórico completo de ações no sistema.
              </p>
            </div>
            <Link
              href="/configuracoes/logs"
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            >
              Ver logs
            </Link>
          </div>
        </div>
      )}

      {/* Aparência */}
      <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Aparência</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Escolha o tema da interface.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`rounded-[var(--radius-lg)] border px-4 py-2.5 text-sm font-medium transition-all duration-[var(--speed-quick)] ${
              theme === "light"
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Modo claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`rounded-[var(--radius-lg)] border px-4 py-2.5 text-sm font-medium transition-all duration-[var(--speed-quick)] ${
              theme === "dark"
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Modo escuro
          </button>
        </div>
      </div>

      {/* Controle de Usuários (Admin only) */}
      {isAdmin && (
        <>
          <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Controle de Usuários</h2>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Gerencie usuários e suas permissões.</p>
              </div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                {filteredUsers.length} usuário(s) {filterRole !== "all" && `de ${PERMISSIONS_INFO[filterRole].label}`}
              </div>
            </div>

            {/* Filtros e busca */}
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar usuário..."
                  className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFilterRole("all")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    filterRole === "all"
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  Todos ({userCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRole("admin_bim")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    filterRole === "admin_bim"
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  Administrador ({userCounts.admin_bim})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRole("auditor_bim")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    filterRole === "auditor_bim"
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  Auditor ({userCounts.auditor_bim})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRole("leitor")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    filterRole === "leitor"
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  Leitor ({userCounts.leitor})
                </button>
              </div>
            </div>

            {/* Mensagem de erro ou loading */}
            {usersLoading && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando usuários...</p>
            )}
            {usersError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Erro ao carregar usuários: {String(usersError)}
                <br />
                <span className="text-xs">Verifique se você tem permissão de administrador e se há usuários cadastrados.</span>
              </div>
            )}

            {/* Tabela de usuários */}
            {!usersLoading && !usersError && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className="px-4 py-3 text-left text-sm font-medium text-[hsl(var(--foreground))]">Usuário</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-[hsl(var(--foreground))]">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-[hsl(var(--foreground))]">Grupo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-[hsl(var(--foreground))]">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-[hsl(var(--foreground))]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center text-sm font-semibold text-white">
                              {user.nomeCompleto
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <span className="font-medium text-[hsl(var(--foreground))]">{user.nomeCompleto}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-medium text-[hsl(var(--foreground))]">
                            {permissionsConfig[user.perfil]?.label || PERMISSIONS_INFO[user.perfil].label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Ativo
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingUserId === user.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value as "admin_bim" | "auditor_bim" | "leitor")}
                                className="rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))]"
                              >
                                <option value="admin_bim">Administrador</option>
                                <option value="auditor_bim">Auditor</option>
                                <option value="leitor">Leitor</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  updateRoleMutation.mutate({ userId: user.id, role: selectedRole });
                                }}
                                disabled={updateRoleMutation.isPending}
                                className="rounded-lg bg-[hsl(var(--accent))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                              >
                                {updateRoleMutation.isPending ? "Salvando..." : "Salvar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingUserId(null)}
                                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="relative flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditUser(user)}
                                className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
                              >
                                Editar
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (openMenuId === user.id) {
                                      setOpenMenuId(null);
                                      setMenuPosition(null);
                                    } else {
                                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                      setMenuPosition({
                                        top: rect.bottom + 4,
                                        right: window.innerWidth - rect.right,
                                      });
                                      setOpenMenuId(user.id);
                                    }
                                  }}
                                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                                  title="Mais opções"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="12" cy="5" r="1" />
                                    <circle cx="12" cy="19" r="1" />
                                  </svg>
                                </button>
                                {openMenuId === user.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                      }}
                                    />
                                    <div
                                      className="fixed z-20 w-48 min-w-[12rem] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1"
                                      style={
                                        menuPosition
                                          ? { top: menuPosition.top, right: menuPosition.right }
                                          : undefined
                                      }
                                    >
                                      <div className="py-1">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            setOpenMenuId(null);
                                            setMenuPosition(null);
                                            const ok = await confirm({
                                              title: "Reenviar email de confirmação",
                                              message: `Deseja reenviar o email de confirmação para ${user.email}?`,
                                              confirmLabel: "Reenviar",
                                            });
                                            if (!ok) return;
                                            try {
                                              await resendConfirmationEmail(user.email);
                                              toast.success("Email enviado com sucesso. O usuário deve verificar a caixa de entrada.");
                                            } catch (err) {
                                              toast.error(err instanceof Error ? err.message : "Erro ao reenviar email");
                                            }
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                              <polyline points="22,6 12,13 2,6" />
                                            </svg>
                                            Reenviar email de confirmação
                                          </div>
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    {searchTerm || filterRole !== "all" ? "Nenhum usuário encontrado com os filtros aplicados." : "Nenhum usuário cadastrado."}
                  </div>
                )}
              </div>
            )}

            {/* Lista antiga (mantida como fallback) */}
            {false && (
              <div className="mt-4 space-y-3">
                {filteredUsers.map((user) => (
                <div key={user.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  {editingUserId === user.id ? (
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-[hsl(var(--foreground))]">{user.nomeCompleto}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{user.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Permissão</label>
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as "admin_bim" | "auditor_bim" | "leitor")}
                          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                        >
                          <option value="admin_bim">Administrador</option>
                          <option value="auditor_bim">Auditor</option>
                          <option value="leitor">Leitor</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateRoleMutation.mutate({ userId: user.id, role: selectedRole });
                          }}
                          disabled={updateRoleMutation.isPending}
                          className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
                        >
                          {updateRoleMutation.isPending ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-90"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[hsl(var(--foreground))]">{user.nomeCompleto}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{user.email}</p>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          Permissão: <span className="font-medium">{PERMISSIONS_INFO[user.perfil].label}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEditUser(user)}
                        className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>
                ))}
              </div>
            )}
          </div>

          {/* Controle de Acesso - Permissões Editáveis */}
          <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Controle de Acesso</h2>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                  Configure as permissões de cada perfil. As alterações são salvas automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPermissionsConfig(PERMISSIONS_INFO);
                  savePermissionsConfig(PERMISSIONS_INFO);
                  toast.success("Permissões restauradas para os valores padrão.");
                }}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                Restaurar padrões
              </button>
            </div>
            <div className="mt-4 space-y-6">
              {Object.entries(permissionsConfig).map(([role, info]) => {
                const roleKey = role as "admin_bim" | "auditor_bim" | "leitor";
                const isEditing = editingPermissions === roleKey;

                return (
                  <div key={role} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-medium text-[hsl(var(--foreground))]">{info.label}</h3>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPermissions(roleKey);
                            setSelectedScreens(new Set(info.permissions as ScreenId[]));
                          }}
                          className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
                        >
                          Editar
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {AVAILABLE_SCREENS.map((screen) => {
                            const isSelected = selectedScreens.has(screen.id);
                            return (
                              <label
                                key={screen.id}
                                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                  isSelected
                                    ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                                    : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--accent))]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedScreens);
                                    if (e.target.checked) {
                                      newSet.add(screen.id);
                                    } else {
                                      newSet.delete(screen.id);
                                    }
                                    setSelectedScreens(newSet);
                                  }}
                                  className="mt-0.5 h-4 w-4 rounded border-[hsl(var(--input))] text-[hsl(var(--accent))] focus:ring-[hsl(var(--ring))]"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-[hsl(var(--foreground))]">{screen.label}</div>
                                  <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{screen.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                // Selecionar todas
                                setSelectedScreens(new Set(AVAILABLE_SCREENS.map((s) => s.id)));
                              }}
                              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                            >
                              Selecionar todas
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                // Desmarcar todas
                                setSelectedScreens(new Set());
                              }}
                              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                            >
                              Desmarcar todas
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...permissionsConfig };
                                updated[roleKey] = {
                                  ...updated[roleKey],
                                  permissions: Array.from(selectedScreens),
                                };
                                setPermissionsConfig(updated);
                                savePermissionsConfig(updated);
                                if (me) {
                                  logActivityAsync({
                                    userId: me.id,
                                    userName: me.name,
                                    userEmail: me.email,
                                    userRole: me.role,
                                    action: "UPDATE",
                                    entity: "CONFIGURACAO",
                                    details: `Permissões alteradas para perfil ${roleKey}`,
                                    newValue: { role: roleKey, permissions: Array.from(selectedScreens) },
                                  });
                                }
                                setEditingPermissions(null);
                                setSelectedScreens(new Set());
                                toast.success("Permissões salvas com sucesso!");
                              }}
                              className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
                            >
                              Salvar alterações
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPermissions(null);
                                setSelectedScreens(new Set());
                              }}
                              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">
                          {info.permissions.length} tela(s) com acesso
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {info.permissions.map((screenId) => {
                            const screen = AVAILABLE_SCREENS.find((s) => s.id === screenId);
                            if (!screen) return null;
                            return (
                              <div
                                key={screenId}
                                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2"
                              >
                                <div className="font-medium text-sm text-[hsl(var(--foreground))]">{screen.label}</div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">{screen.description}</div>
                              </div>
                            );
                          })}
                        </div>
                        {info.permissions.length === 0 && (
                          <p className="text-sm text-[hsl(var(--muted-foreground))] italic">Nenhuma tela com acesso configurada.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Container>
  );
}
