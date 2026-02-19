/**
 * API via Supabase — substitui a chamada à API NestJS.
 * Auth: Supabase Auth. Dados: PostgREST (dim_obras, fato_auditorias, etc.)
 */
import { createSupabaseClient } from "./supabase/client";

const supabase = createSupabaseClient();

// --- Auth ---
export type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
};

export type MeResponse = { id: string; email: string; name: string; role: string; avatarUrl?: string };

export async function authMe(): Promise<MeResponse> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("❌ authMe: Não autenticado", authError);
    throw new Error("Não autenticado");
  }

  // Buscar usuário na dim_usuarios
  const { data: dimUser, error: dimError } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (dimUser) {
    const roleMap: Record<string, string> = { admin_bim: "admin_bim", auditor_bim: "auditor_bim", leitor: "leitor" };
    const role = roleMap[dimUser.perfil] ?? "auditor_bim";
    return {
      id: dimUser.id,
      email: dimUser.email,
      name: dimUser.nomeCompleto,
      role,
    };
  }

  // Se não encontrou, tentar criar usando RPC
  const { error: rpcError } = await supabase.rpc("ensure_dim_usuario");

  // Tentar buscar novamente após criar
  const { data: newDimUser, error: newDimError } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  
  if (newDimUser) {
    const roleMap: Record<string, string> = { admin_bim: "admin_bim", auditor_bim: "auditor_bim", leitor: "leitor" };
    const role = roleMap[newDimUser.perfil] ?? "auditor_bim";
    return {
      id: newDimUser.id,
      email: newDimUser.email,
      name: newDimUser.nomeCompleto,
      role,
    };
  }

  // Fallback: retornar dados básicos do auth user
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.nome ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "",
    role: "auditor_bim",
  };
}

export async function register(email: string, password: string, nomeCompleto: string): Promise<LoginResponse> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome: nomeCompleto,
        name: nomeCompleto,
      },
    },
  });
  if (error) throw new Error(error.message ?? "Erro ao criar conta");

  if (!data.user) {
    throw new Error("Erro ao criar usuário");
  }

  // Aguardar um pouco para garantir que o trigger do banco criou o dim_usuario
  await new Promise((resolve) => setTimeout(resolve, 500));

  const user = data.user;
  let { data: dimUser } = await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).maybeSingle();
  if (!dimUser) {
    await supabase.rpc("ensure_dim_usuario").catch(() => {}); // Ignorar erro se RPC não existir
    const { data: newDimUser } = await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).maybeSingle();
    dimUser = newDimUser ?? null;
  }
  const roleMap: Record<string, string> = {
    admin_bim: "admin_bim",
    auditor_bim: "auditor_bim",
    leitor: "leitor",
  };
  return {
    accessToken: data.session?.access_token ?? "",
    user: {
      id: dimUser?.id ?? user.id,
      email: dimUser?.email ?? user.email ?? "",
      name: dimUser?.nomeCompleto ?? user.user_metadata?.nome ?? user.email?.split("@")[0] ?? "",
      role: dimUser ? (roleMap[dimUser.perfil] ?? "auditor_bim") : "auditor_bim",
    },
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message ?? "Credenciais inválidas");

  const user = data.user;
  let { data: dimUser } = await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).maybeSingle();
  if (!dimUser) {
    await supabase.rpc("ensure_dim_usuario").catch(() => {}); // Ignorar erro se RPC não existir
    const { data: newDimUser } = await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).maybeSingle();
    dimUser = newDimUser ?? null;
  }
  const roleMap: Record<string, string> = {
    admin_bim: "admin_bim",
    auditor_bim: "auditor_bim",
    leitor: "leitor",
  };
  return {
    accessToken: data.session?.access_token ?? "",
    user: {
      id: dimUser?.id ?? user.id,
      email: dimUser?.email ?? user.email ?? "",
      name: dimUser?.nomeCompleto ?? user.user_metadata?.nome ?? user.email?.split("@")[0] ?? "",
      role: dimUser ? (roleMap[dimUser.perfil] ?? "auditor_bim") : "auditor_bim",
    },
  };
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    document.cookie = `auth-token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export async function logout() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    document.cookie = "auth-token=; path=/; max-age=0";
  }
}

/** Solicita recuperação de senha via email */
export async function forgotPassword(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw new Error(error.message ?? "Erro ao enviar email de recuperação");
}

/** Redefine a senha usando o token do link de recuperação */
export async function resetPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw new Error(error.message ?? "Erro ao redefinir senha");
}

export function getTokenFromCookie(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/auth-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Verifica sessão Supabase (para ProtectedRoute) */
export async function hasValidSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data?.session;
}

/** Server-side: não usado em SPA Supabase */
export async function apiServer<T>(
  _path: string,
  _token: string | null | undefined,
  _options?: RequestInit
): Promise<T> {
  throw new Error("apiServer não suportado em modo Supabase");
}

// --- Helpers para Supabase ---
function toWorkRow(row: { id: string; nome: string; codigo: string | null; ativo: boolean }) {
  return { id: row.id, name: row.nome, code: row.codigo, active: row.ativo };
}

// --- Works (dim_obras) ---
export type WorkRow = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  phases?: { id: string; name: string; order: number }[];
};

export async function worksList(): Promise<WorkRow[]> {
  const { data, error } = await supabase
    .from("dim_obras")
    .select("id, nome, codigo, ativo")
    .is("deletedAt", null)
    .order("createdAt", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toWorkRow);
}

export async function workGet(id: string): Promise<WorkRow> {
  const { data, error } = await supabase
    .from("dim_obras")
    .select("id, nome, codigo, ativo")
    .eq("id", id)
    .is("deletedAt", null)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Obra não encontrada");
  return toWorkRow(data);
}

export async function workCreate(payload: { name: string; code?: string | null }): Promise<WorkRow> {
  const codigo = payload.code?.trim() || payload.name.replace(/\s+/g, "_").toUpperCase().slice(0, 50) || "OBRA";
  const { data, error } = await supabase
    .from("dim_obras")
    .insert({ nome: payload.name, codigo })
    .select("id, nome, codigo, ativo")
    .single();
  if (error) throw new Error(error.message);
  return toWorkRow(data);
}

export async function workUpdate(
  id: string,
  payload: { name?: string; code?: string | null; active?: boolean }
): Promise<WorkRow> {
  const updates: Record<string, unknown> = {};
  if (payload.name != null) updates.nome = payload.name;
  if (payload.code !== undefined) updates.codigo = payload.code ?? null;
  if (payload.active !== undefined) updates.ativo = payload.active;
  const { data, error } = await supabase
    .from("dim_obras")
    .update(updates)
    .eq("id", id)
    .select("id, nome, codigo, ativo")
    .single();
  if (error) throw new Error(error.message);
  return toWorkRow(data);
}

export type PhaseRow = { id: string; name: string; code: string | null; order: number };
export async function worksPhases(_workId: string): Promise<PhaseRow[]> {
  const { data, error } = await supabase
    .from("dim_fases")
    .select("id, nome, codigo, ordemSequencial")
    .eq("ativo", true)
    .order("ordemSequencial");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.nome, code: r.codigo ?? null, order: r.ordemSequencial }));
}

// --- Library ---
export type AuditPhaseRow = { id: string; name: string; label: string; order: number };
export type DisciplineRow = { id: string; name: string; code: string | null; order: number };
export type CategoryRow = { id: string; name: string; disciplineId: string; order: number };
export type ChecklistItemRow = {
  id: string;
  description: string;
  categoryId: string;
  auditPhaseId: string;
  weight: number;
  maxPoints: number;
};

export type ChecklistItemWithCategory = {
  id: string;
  description: string;
  categoryId: string;
  categoryName: string;
  weight: number;
  maxPoints: number;
  disciplineIds: string[];
};

export async function libraryAuditPhases(): Promise<AuditPhaseRow[]> {
  const { data, error } = await supabase
    .from("dim_fases")
    .select("id, nome, codigo, ordemSequencial")
    .eq("ativo", true)
    .order("ordemSequencial");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.nome, label: r.codigo ?? r.nome, order: r.ordemSequencial }));
}

export async function libraryDisciplines(): Promise<DisciplineRow[]> {
  const { data, error } = await supabase
    .from("dim_disciplinas")
    .select("id, nome, codigo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r, i) => ({ id: r.id, name: r.nome, code: r.codigo ?? null, order: i }));
}

/** Atualiza uma disciplina */
export async function updateLibraryDiscipline(disciplineId: string, body: { name: string }): Promise<DisciplineRow> {
  const codigo = body.name.replace(/\s+/g, "_").toUpperCase().slice(0, 20) || "DISC";
  const { data, error } = await supabase
    .from("dim_disciplinas")
    .update({ nome: body.name, codigo })
    .eq("id", disciplineId)
    .select("id, nome, codigo")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.nome, code: data.codigo ?? null, order: 0 };
}

/** Exclui (desativa) uma disciplina */
export async function deleteLibraryDiscipline(disciplineId: string): Promise<void> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para excluir disciplinas.");
  const { error } = await supabase
    .from("dim_disciplinas")
    .update({ ativo: false })
    .eq("id", disciplineId);
  if (error) throw new Error(error.message);
}

export async function libraryCategories(disciplineId?: string): Promise<CategoryRow[]> {
  if (disciplineId) {
    const { data, error } = await supabase
      .from("dim_categorias_disciplinas")
      .select("ordemExibicao, dim_categorias(id, nome)")
      .eq("disciplinaId", disciplineId)
      .order("ordemExibicao");
    if (error) throw new Error(error.message);
    const cats = (data ?? []).filter((r) => r.dim_categorias != null) as { ordemExibicao: number; dim_categorias: { id: string; nome: string } }[];
    const { data: ativos } = await supabase.from("dim_categorias").select("id").eq("ativo", true);
    const ativoIds = new Set((ativos ?? []).map((a) => a.id));
    return cats
      .filter((c) => ativoIds.has(c.dim_categorias.id))
      .map((c) => ({
        id: c.dim_categorias.id,
        name: c.dim_categorias.nome,
        disciplineId,
        order: c.ordemExibicao,
      }));
  }
  const { data, error } = await supabase
    .from("dim_categorias")
    .select("id, nome, ordemExibicao")
    .eq("ativo", true)
    .order("ordemExibicao");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.nome,
    disciplineId: "",
    order: r.ordemExibicao,
  }));
}

export async function libraryChecklistItems(params?: {
  disciplineId?: string;
  categoryId?: string;
  auditPhaseId?: string;
}): Promise<ChecklistItemRow[]> {
  let q = supabase.from("tbl_checklist_template").select("id, itemVerificacao, categoriaId, peso, pontosMaximo").eq("ativo", true);
  if (params?.disciplineId) q = q.eq("disciplinaId", params.disciplineId);
  if (params?.categoryId) q = q.eq("categoriaId", params.categoryId);
  const { data: items, error } = await q.order("ordemExibicao");
  if (error) throw new Error(error.message);
  const list = items ?? [];
  if (params?.auditPhaseId) {
    const { data: app } = await supabase
      .from("tbl_template_aplicabilidade_fases")
      .select("templateItemId")
      .eq("faseId", params.auditPhaseId);
    const ids = new Set((app ?? []).map((a) => a.templateItemId));
    return list
      .filter((i) => ids.has(i.id))
      .map((r) => ({
        id: r.id,
        description: r.itemVerificacao,
        categoryId: r.categoriaId,
        auditPhaseId: params.auditPhaseId!,
        weight: r.peso,
        maxPoints: Number(r.pontosMaximo),
      }));
  }
  return list.map((r) => ({
    id: r.id,
    description: r.itemVerificacao,
    categoryId: r.categoriaId,
    auditPhaseId: "",
    weight: r.peso,
    maxPoints: Number(r.pontosMaximo),
  }));
}

/** Lista todos os itens de verificação únicos, agrupados por descrição e categoria */
export async function libraryAllChecklistItemsUnique(): Promise<ChecklistItemWithCategory[]> {
  // Buscar todos os itens
  const { data: items, error } = await supabase
    .from("tbl_checklist_template")
    .select("id, itemVerificacao, categoriaId, peso, pontosMaximo, disciplinaId")
    .eq("ativo", true)
    .order("itemVerificacao");

  if (error) throw new Error(error.message);

  // Buscar todas as categorias de uma vez
  const categoryIds = [...new Set((items ?? []).map((i) => i.categoriaId))];
  const { data: categories } = await supabase
    .from("dim_categorias")
    .select("id, nome")
    .in("id", categoryIds);

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.nome]));

  // Agrupar por descrição + categoria (mesmo item pode estar em múltiplas disciplinas)
  const grouped = new Map<string, ChecklistItemWithCategory>();

  for (const item of items ?? []) {
    const key = `${item.itemVerificacao.trim()}_${item.categoriaId}`;
    const categoryName = categoryMap.get(item.categoriaId) || "Categoria desconhecida";

    if (grouped.has(key)) {
      // Item já existe, adicionar disciplina se não estiver na lista
      const existing = grouped.get(key)!;
      if (item.disciplinaId && !existing.disciplineIds.includes(item.disciplinaId)) {
        existing.disciplineIds.push(item.disciplinaId);
      }
    } else {
      // Novo item único - usar o primeiro ID encontrado
      grouped.set(key, {
        id: item.id,
        description: item.itemVerificacao,
        categoryId: item.categoriaId,
        categoryName,
        weight: item.peso,
        maxPoints: Number(item.pontosMaximo),
        disciplineIds: item.disciplinaId ? [item.disciplinaId] : [],
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    // Ordenar por categoria e depois por descrição
    if (a.categoryName !== b.categoryName) {
      return a.categoryName.localeCompare(b.categoryName);
    }
    return a.description.localeCompare(b.description);
  });
}

// --- Audits ---
export type AuditListItem = {
  id: string;
  title: string;
  status: string;
  work?: { name: string };
  phase?: { name: string };
  discipline?: { name: string };
  auditPhase?: { name: string; label: string };
  auditor?: { name: string };
  startDate: string;
};

export type AuditDetail = {
  id: string;
  title: string;
  status: string;
  work?: { name: string };
  phase?: { name: string };
  discipline?: { name: string };
  auditPhase?: { name: string; label: string };
  auditor?: { name: string };
  startDate: string;
  endDate?: string | null;
};

export type AuditItemRow = {
  id: string;
  status: string;
  evidenceText?: string | null;
  construflowRef?: string | null;
  nextReviewAt?: string | null;
  checklistItem?: { description: string; category?: { name: string; discipline?: { name: string } } };
  customItem?: { description: string; discipline?: { name: string }; category?: { name: string } };
};

/** Itens com pontos para relatório e cálculo de score */
export type AuditReportItemRow = AuditItemRow & {
  pontosMaximo: number;
  pontosObtidos: number;
  disciplineId?: string;
  disciplineName?: string;
};

/** Dados consolidados do relatório (score calculado a partir dos itens) */
export type AuditReportScore = {
  scoreGeral: number;
  pontosObtidos: number;
  pontosPossiveis: number;
  totalItens: number;
  totalAplicavel: number;
  totalConforme: number;
  totalNaoConforme: number;
  totalNA: number;
};

export type AuditReportScoreByDiscipline = {
  disciplineId: string;
  disciplineName: string;
  score: number;
  pontosObtidos: number;
  pontosPossiveis: number;
  totalAplicavel: number;
};

function toAuditListItem(a: {
  id: string;
  titulo?: string | null;
  codigoAuditoria: string;
  status: string;
  dataInicio: string;
  dim_obras?: { nome: string } | null;
  dim_fases?: { nome: string; codigo: string } | null;
  dim_disciplinas?: { nome: string } | null;
  dim_usuarios?: { nomeCompleto: string } | null;
}): AuditListItem {
  return {
    id: a.id,
    title: a.titulo ?? a.codigoAuditoria,
    status: a.status,
    work: a.dim_obras ? { name: a.dim_obras.nome } : undefined,
    phase: a.dim_fases ? { name: a.dim_fases.nome } : undefined,
    discipline: a.dim_disciplinas ? { name: a.dim_disciplinas.nome } : undefined,
    auditPhase: a.dim_fases ? { name: a.dim_fases.nome, label: a.dim_fases.codigo ?? a.dim_fases.nome } : undefined,
    auditor: a.dim_usuarios ? { name: a.dim_usuarios.nomeCompleto } : undefined,
    startDate: a.dataInicio,
  };
}

export function auditsList(params: {
  workId?: string;
  phaseId?: string;
  status?: string;
  auditorId?: string;
}) {
  let q = supabase
    .from("fato_auditorias")
    .select(`
      id, titulo, codigoAuditoria, status, dataInicio,
      dim_obras!fato_auditorias_obraId_fkey(nome),
      dim_fases!fato_auditorias_faseId_fkey(nome, codigo),
      dim_disciplinas!fato_auditorias_disciplinaId_fkey(nome),
      dim_usuarios!fato_auditorias_auditorResponsavelId_fkey(nomeCompleto)
    `)
    .order("createdAt", { ascending: false });
  if (params.workId) q = q.eq("obraId", params.workId);
  if (params.phaseId) q = q.eq("faseId", params.phaseId);
  if (params.status) q = q.eq("status", params.status);
  if (params.auditorId) q = q.eq("auditorResponsavelId", params.auditorId);
  return q.then(({ data, error }) => {
    if (error) throw new Error(error.message);
    return (data ?? []).map((a: Record<string, unknown>) =>
      toAuditListItem({
        id: a.id as string,
        titulo: a.titulo as string | null,
        codigoAuditoria: a.codigoAuditoria as string,
        status: a.status as string,
        dataInicio: a.dataInicio as string,
        dim_obras: a.dim_obras as { nome: string } | null,
        dim_fases: a.dim_fases as { nome: string; codigo: string } | null,
        dim_disciplinas: a.dim_disciplinas as { nome: string } | null,
        dim_usuarios: a.dim_usuarios as { nomeCompleto: string } | null,
      })
    );
  });
}

export async function auditGet(id: string): Promise<AuditDetail> {
  const { data, error } = await supabase
    .from("fato_auditorias")
    .select(`
      id, titulo, codigoAuditoria, status, dataInicio, dataFimPrevista, dataConclusao,
      dim_obras!fato_auditorias_obraId_fkey(nome),
      dim_fases!fato_auditorias_faseId_fkey(nome, codigo),
      dim_disciplinas!fato_auditorias_disciplinaId_fkey(nome),
      dim_usuarios!fato_auditorias_auditorResponsavelId_fkey(nomeCompleto)
    `)
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Auditoria não encontrada");
  return {
    id: data.id,
    title: data.titulo ?? data.codigoAuditoria,
    status: data.status,
    work: data.dim_obras ? { name: data.dim_obras.nome } : undefined,
    phase: data.dim_fases ? { name: data.dim_fases.nome } : undefined,
    discipline: data.dim_disciplinas ? { name: data.dim_disciplinas.nome } : undefined,
    auditPhase: data.dim_fases ? { name: data.dim_fases.nome, label: data.dim_fases.codigo ?? data.dim_fases.nome } : undefined,
    auditor: data.dim_usuarios ? { name: data.dim_usuarios.nomeCompleto } : undefined,
    startDate: data.dataInicio,
    endDate: data.dataConclusao ?? data.dataFimPrevista ?? null,
  };
}

export async function auditItems(id: string): Promise<AuditItemRow[]> {
  const { data, error } = await supabase
    .from("fato_auditoria_itens")
    .select(`
      id, status, evidenciaObservacao, codigoConstruflow, proximaRevisao,
      tbl_checklist_template!fato_auditoria_itens_templateItemId_fkey(itemVerificacao, dim_categorias(nome, dim_disciplinas(nome)))
    `)
    .eq("auditoriaId", id)
    .order("ordemExibicao");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const tpl = r.tbl_checklist_template as { itemVerificacao: string; dim_categorias?: { nome: string; dim_disciplinas?: { nome: string } } } | null;
    const dbStatus = r.status as string;
    return {
      id: r.id,
      status: STATUS_FROM_DB[dbStatus] ?? dbStatus,
      evidenceText: r.evidenciaObservacao ?? null,
      construflowRef: r.codigoConstruflow ?? null,
      nextReviewAt: r.proximaRevisao ?? null,
      checklistItem: tpl
        ? {
            description: tpl.itemVerificacao,
            category: tpl.dim_categorias
              ? { name: tpl.dim_categorias.nome, discipline: tpl.dim_categorias.dim_disciplinas ? { name: tpl.dim_categorias.dim_disciplinas.nome } : undefined }
              : undefined,
          }
        : undefined,
      customItem: undefined,
    };
  });
}

/** Itens da auditoria com pontos e disciplina para relatório e score */
export async function auditItemsForReport(id: string): Promise<AuditReportItemRow[]> {
  const { data, error } = await supabase
    .from("fato_auditoria_itens")
    .select(`
      id, status, evidenciaObservacao, codigoConstruflow, proximaRevisao, pontosMaximoSnapshot, pontosObtidos, disciplinaId,
      dim_disciplinas!fato_auditoria_itens_disciplinaId_fkey(nome),
      tbl_checklist_template!fato_auditoria_itens_templateItemId_fkey(itemVerificacao, dim_categorias(nome, dim_disciplinas(nome)))
    `)
    .eq("auditoriaId", id)
    .order("ordemExibicao");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const tpl = r.tbl_checklist_template as { itemVerificacao: string; dim_categorias?: { nome: string; dim_disciplinas?: { nome: string } } } | null;
    const dbStatus = r.status as string;
    const disc = r.dim_disciplinas as { nome: string } | null;
    const pontosMax = Number((r as { pontosMaximoSnapshot?: string | number }).pontosMaximoSnapshot ?? 0);
    const pontosObt = Number((r as { pontosObtidos?: string | number }).pontosObtidos ?? 0);
    return {
      id: r.id as string,
      status: STATUS_FROM_DB[dbStatus as string] ?? (dbStatus as string),
      evidenceText: (r.evidenciaObservacao as string) ?? null,
      construflowRef: (r.codigoConstruflow as string) ?? null,
      nextReviewAt: (r.proximaRevisao as string) ?? null,
      pontosMaximo: pontosMax,
      pontosObtidos: pontosObt,
      disciplineId: (r.disciplinaId as string) ?? undefined,
      disciplineName: disc?.nome ?? undefined,
      checklistItem: tpl
        ? {
            description: tpl.itemVerificacao,
            category: tpl.dim_categorias
              ? { name: tpl.dim_categorias.nome, discipline: tpl.dim_categorias.dim_disciplinas ? { name: tpl.dim_categorias.dim_disciplinas.nome } : undefined }
              : undefined,
          }
        : undefined,
      customItem: undefined,
    };
  });
}

/** Pontos efetivos por item conforme FR-14: conforme = 100%, não conforme = 0%, N/A excluído */
function pontosEfetivosPorStatus(item: AuditReportItemRow): number {
  if (item.status === "NA") return 0;
  if (item.status === "CONFORMING") return item.pontosMaximo;
  if (item.status === "NONCONFORMING" || item.status === "NOT_STARTED") return 0;
  if (item.status === "OBSERVATION") return Math.round(item.pontosMaximo * 0.5 * 100) / 100; // parcial (opcional)
  return Number(item.pontosObtidos) || 0;
}

/** Calcula score geral e por disciplina a partir dos itens do relatório */
export function computeAuditScores(
  items: AuditReportItemRow[]
): { score: AuditReportScore; byDiscipline: AuditReportScoreByDiscipline[] } {
  const aplicaveis = items.filter((i) => i.status !== "NA");
  const pontosObtidos = aplicaveis.reduce((s, i) => s + pontosEfetivosPorStatus(i), 0);
  const pontosPossiveis = aplicaveis.reduce((s, i) => s + i.pontosMaximo, 0);
  const scoreGeral = pontosPossiveis > 0 ? Math.round((pontosObtidos / pontosPossiveis) * 100 * 100) / 100 : 0;
  const byDisciplineMap = new Map<string, { name: string; obtidos: number; possiveis: number; aplicavel: number }>();
  for (const i of aplicaveis) {
    const key = i.disciplineId ?? "";
    const name = i.disciplineName ?? "Outros";
    if (!byDisciplineMap.has(key)) byDisciplineMap.set(key, { name, obtidos: 0, possiveis: 0, aplicavel: 0 });
    const d = byDisciplineMap.get(key)!;
    d.obtidos += pontosEfetivosPorStatus(i);
    d.possiveis += i.pontosMaximo;
    d.aplicavel += 1;
  }
  const byDiscipline: AuditReportScoreByDiscipline[] = [];
  byDisciplineMap.forEach((v, disciplineId) => {
    const score = v.possiveis > 0 ? Math.round((v.obtidos / v.possiveis) * 100 * 100) / 100 : 0;
    byDiscipline.push({
      disciplineId,
      disciplineName: v.name,
      score,
      pontosObtidos: v.obtidos,
      pontosPossiveis: v.possiveis,
      totalAplicavel: v.aplicavel,
    });
  });
  const totalConforme = items.filter((i) => i.status === "CONFORMING").length;
  const totalNaoConforme = items.filter((i) => i.status === "NONCONFORMING").length;
  const totalNA = items.filter((i) => i.status === "NA").length;
  return {
    score: {
      scoreGeral,
      pontosObtidos,
      pontosPossiveis,
      totalItens: items.length,
      totalAplicavel: aplicaveis.length,
      totalConforme,
      totalNaoConforme,
      totalNA,
    },
    byDiscipline,
  };
}

export async function auditFinishVerification(id: string): Promise<AuditDetail> {
  const itens = await auditItems(id);
  const pendentes = itens.filter((i) => i.status === "NOT_STARTED");
  if (pendentes.length > 0) {
    throw new Error("Finalize a avaliação de todos os itens antes de finalizar a verificação.");
  }
  const { error } = await supabase
    .from("fato_auditorias")
    .update({ status: "aguardando_apontamentos" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return auditGet(id);
}

export async function auditComplete(id: string): Promise<AuditDetail> {
  const itens = await auditItems(id);
  const ncs = itens.filter((i) => i.status === "NONCONFORMING");
  const ncsIncompletos = ncs.filter(
    (i) => !(i.construflowRef && i.construflowRef.trim()) || !(i.evidenceText && i.evidenceText.trim())
  );
  if (ncsIncompletos.length > 0) {
    throw new Error(
      "Não é possível concluir: todos os itens não conformes devem ter Construflow ID e evidência/observações preenchidos."
    );
  }
  const { error } = await supabase
    .from("fato_auditorias")
    .update({ status: "concluida", dataConclusao: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return auditGet(id);
}

export async function auditCancel(id: string, reason?: string | null): Promise<AuditDetail> {
  const { data: me } = await authMe();
  const { error } = await supabase
    .from("fato_auditorias")
    .update({
      status: "cancelada",
      motivoCancelamento: reason ?? null,
      canceladoPorId: me.id,
      canceladoEm: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return auditGet(id);
}

const STATUS_TO_DB: Record<string, string> = {
  NOT_STARTED: "nao_iniciado",
  CONFORMING: "conforme",
  NONCONFORMING: "nao_conforme",
  OBSERVATION: "nao_aplicavel",
  NA: "nao_aplicavel",
};
const STATUS_FROM_DB: Record<string, string> = {
  nao_iniciado: "NOT_STARTED",
  conforme: "CONFORMING",
  nao_conforme: "NONCONFORMING",
  nao_aplicavel: "NA",
  corrigido: "CONFORMING",
};

export async function auditUpdateItem(
  auditId: string,
  itemId: string,
  payload: { status?: string; evidenceText?: string; construflowRef?: string }
): Promise<AuditItemRow> {
  const updates: Record<string, unknown> = {};
  if (payload.status != null) updates.status = STATUS_TO_DB[payload.status] ?? payload.status;
  if (payload.evidenceText != null) updates.evidenciaObservacao = payload.evidenceText;
  if (payload.construflowRef != null) updates.codigoConstruflow = payload.construflowRef;
  const { error } = await supabase.from("fato_auditoria_itens").update(updates).eq("id", itemId).eq("auditoriaId", auditId);
  if (error) throw new Error(error.message);
  const items = await auditItems(auditId);
  const found = items.find((i) => i.id === itemId);
  if (!found) throw new Error("Item não encontrado");
  return found;
}

// Chamada genérica para compatibilidade com páginas existentes
export async function api<T>(
  path: string,
  options?: { method?: string; body?: string }
): Promise<T> {
  const body = options?.body ? JSON.parse(options.body) : {};
  const method = options?.method ?? "GET";

  if (path === "/audits" || path.startsWith("/audits?")) {
    if (method === "POST") return createAudit(body) as Promise<T>;
    const u = new URL(path, "http://x");
    return auditsList({
      workId: u.searchParams.get("workId") ?? undefined,
      phaseId: u.searchParams.get("phaseId") ?? undefined,
      status: u.searchParams.get("status") ?? undefined,
      auditorId: u.searchParams.get("auditorId") ?? undefined,
    }) as Promise<T>;
  }
  if (path === "/library/disciplines") {
    if (method === "POST") return libraryCreateDiscipline(body) as Promise<T>;
  }
  if (path.startsWith("/library/audit-phases")) {
    if (method === "POST") return libraryCreateAuditPhase(body) as Promise<T>;
  }
  if (path === "/library/categories") {
    if (method === "POST") return libraryCreateCategory(body) as Promise<T>;
  }
  const matchCatDisc = path.match(/^\/library\/categories\/([^/]+)\/disciplines$/);
  if (matchCatDisc && method === "POST") {
    return libraryLinkCategoryToDiscipline(matchCatDisc[1], body.disciplineId, body.order) as Promise<T>;
  }
  if (path === "/library/checklist-items") {
    if (method === "POST") return libraryCreateChecklistItem(body) as Promise<T>;
  }
  throw new Error(`api(${path}) não implementado em modo Supabase`);
}

async function libraryCreateDiscipline(body: { name: string; order?: number }) {
  const codigo = body.name.replace(/\s+/g, "_").toUpperCase().slice(0, 20) || "DISC";
  const { data, error } = await supabase
    .from("dim_disciplinas")
    .insert({ nome: body.name, codigo, ativo: true })
    .select("id, nome")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.nome, order: body.order ?? 0 };
}

async function libraryCreateAuditPhase(body: { name: string; label?: string; order?: number }) {
  const codigo = body.label ?? (body.name.replace(/\s+/g, "_").toUpperCase().slice(0, 20) || "FASE");
  const { data, error } = await supabase
    .from("dim_fases")
    .insert({ nome: body.name, codigo, ordemSequencial: body.order ?? 0, ativo: true })
    .select("id, nome, codigo, ordemSequencial")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.nome, label: data.codigo, order: data.ordemSequencial };
}

async function libraryCreateCategory(body: { name: string; disciplineId: string; order?: number }) {
  const codigo = body.name.replace(/\s+/g, "_").toUpperCase().slice(0, 50) || "CAT";
  const order = body.order ?? 0;
  const { data: cat, error: errCat } = await supabase
    .from("dim_categorias")
    .insert({ nome: body.name, codigo, ordemExibicao: order, ativo: true })
    .select("id, nome, ordemExibicao")
    .single();
  if (errCat) throw new Error(errCat.message);
  const { error: errLink } = await supabase.from("dim_categorias_disciplinas").insert({
    categoriaId: cat.id,
    disciplinaId: body.disciplineId,
    ordemExibicao: order,
  });
  if (errLink) throw new Error(errLink.message);
  return { id: cat.id, name: cat.nome, disciplineId: body.disciplineId, order: cat.ordemExibicao };
}

/** Cria uma categoria e vincula a múltiplas disciplinas */
export async function libraryCreateCategoryWithDisciplines(body: {
  name: string;
  disciplineIds: string[];
  order?: number;
}): Promise<{ id: string; name: string; disciplineIds: string[] }> {
  const codigo = body.name.replace(/\s+/g, "_").toUpperCase().slice(0, 50) || "CAT";
  const order = body.order ?? 0;
  
  // Criar a categoria
  const { data: cat, error: errCat } = await supabase
    .from("dim_categorias")
    .insert({ nome: body.name, codigo, ordemExibicao: order, ativo: true })
    .select("id, nome, ordemExibicao")
    .single();
  if (errCat) throw new Error(errCat.message);

  // Vincular a múltiplas disciplinas
  if (body.disciplineIds.length > 0) {
    const links = body.disciplineIds.map((disciplinaId, index) => ({
      categoriaId: cat.id,
      disciplinaId,
      ordemExibicao: order + index,
    }));

    const { error: errLink } = await supabase.from("dim_categorias_disciplinas").insert(links);
    if (errLink) throw new Error(errLink.message);
  }

  return { id: cat.id, name: cat.nome, disciplineIds: body.disciplineIds };
}

/** Lista todas as categorias (sem filtro de disciplina) */
export async function libraryAllCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("dim_categorias")
    .select("id, nome, ordemExibicao")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.nome,
    disciplineId: "",
    order: r.ordemExibicao,
  }));
}

/** Atualiza uma categoria */
export async function updateLibraryCategory(categoryId: string, body: { name: string }): Promise<CategoryRow> {
  const codigo = body.name.replace(/\s+/g, "_").toUpperCase().slice(0, 50) || "CAT";
  const { data, error } = await supabase
    .from("dim_categorias")
    .update({ nome: body.name, codigo })
    .eq("id", categoryId)
    .select("id, nome, ordemExibicao")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.nome, disciplineId: "", order: data.ordemExibicao };
}

/** Exclui (desativa) uma categoria */
export async function deleteLibraryCategory(categoryId: string): Promise<void> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para excluir categorias.");
  const { error } = await supabase
    .from("dim_categorias")
    .update({ ativo: false })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);
}

/** Vincula uma categoria existente a outra disciplina (evita duplicar a categoria). */
export async function libraryLinkCategoryToDiscipline(
  categoryId: string,
  disciplineId: string,
  order?: number
): Promise<{ categoriaId: string; disciplinaId: string; ordemExibicao: number }> {
  const { data: max } = await supabase
    .from("dim_categorias_disciplinas")
    .select("ordemExibicao")
    .eq("disciplinaId", disciplineId)
    .order("ordemExibicao", { ascending: false })
    .limit(1)
    .single();
  const ordemExibicao = order ?? (max?.ordemExibicao ?? -1) + 1;
  const { data, error } = await supabase
    .from("dim_categorias_disciplinas")
    .insert({ categoriaId: categoryId, disciplinaId: disciplineId, ordemExibicao })
    .select("categoriaId, disciplinaId, ordemExibicao")
    .single();
  if (error) throw new Error(error.message);
  return { categoriaId: data.categoriaId, disciplinaId: data.disciplinaId, ordemExibicao: data.ordemExibicao };
}

async function libraryCreateChecklistItem(body: {
  description: string;
  categoryId: string;
  disciplineId: string;
  auditPhaseId: string;
  weight?: number;
  maxPoints?: number;
}) {
  const { data: link } = await supabase
    .from("dim_categorias_disciplinas")
    .select("disciplinaId")
    .eq("categoriaId", body.categoryId)
    .eq("disciplinaId", body.disciplineId)
    .single();
  if (!link) throw new Error("Categoria não está vinculada a esta disciplina");
  const { data, error } = await supabase
    .from("tbl_checklist_template")
    .insert({
      disciplinaId: body.disciplineId,
      categoriaId: body.categoryId,
      itemVerificacao: body.description,
      peso: body.weight ?? 1,
      pontosMaximo: body.maxPoints ?? 1,
      ordemExibicao: 0,
      ativo: true,
    })
    .select("id, itemVerificacao, categoriaId")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("tbl_template_aplicabilidade_fases").insert({
    templateItemId: data.id,
    faseId: body.auditPhaseId,
    obrigatorio: false,
  });
  return {
    id: data.id,
    description: data.itemVerificacao,
    categoryId: data.categoriaId,
    auditPhaseId: body.auditPhaseId,
    weight: body.weight ?? 1,
    maxPoints: body.maxPoints ?? 1,
  };
}

/** Cria um item de verificação para todas as disciplinas de uma categoria. Apenas auditor_bim ou admin_bim. */
export async function createLibraryVerificationItemForCategory(body: {
  categoryId: string;
  itemVerificacao: string;
  peso?: number;
  pontosMaximo?: number;
  faseIds?: string[];
}): Promise<void> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para adicionar itens na biblioteca.");

  // Buscar todas as disciplinas vinculadas a esta categoria
  const { data: links, error: linksError } = await supabase
    .from("dim_categorias_disciplinas")
    .select("disciplinaId")
    .eq("categoriaId", body.categoryId);

  if (linksError) throw new Error(linksError.message);
  if (!links || links.length === 0) {
    throw new Error("Esta categoria não está vinculada a nenhuma disciplina. Vincule a categoria a uma disciplina primeiro.");
  }

  const disciplineIds = links.map((l) => l.disciplinaId);

  // Criar o item para cada disciplina
  for (const disciplineId of disciplineIds) {
    await createLibraryVerificationItem({
      disciplineId,
      categoryId: body.categoryId,
      itemVerificacao: body.itemVerificacao,
      peso: body.peso,
      pontosMaximo: body.pontosMaximo,
      faseIds: body.faseIds,
    });
  }
}

/** Cria um item de verificação na biblioteca (disciplina + categoria) e vincula a fases específicas ou todas. Apenas auditor_bim ou admin_bim. */
export async function createLibraryVerificationItem(body: {
  disciplineId: string;
  categoryId: string;
  itemVerificacao: string;
  peso?: number;
  pontosMaximo?: number;
  faseIds?: string[]; // Se fornecido, vincula apenas a essas fases. Se não, vincula a todas.
}): Promise<ChecklistItemRow> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para adicionar itens na biblioteca.");
  const { data: link } = await supabase
    .from("dim_categorias_disciplinas")
    .select("disciplinaId")
    .eq("categoriaId", body.categoryId)
    .eq("disciplinaId", body.disciplineId)
    .single();
  if (!link) throw new Error("Categoria não está vinculada a esta disciplina");
  const { data: item, error: errItem } = await supabase
    .from("tbl_checklist_template")
    .insert({
      disciplinaId: body.disciplineId,
      categoriaId: body.categoryId,
      itemVerificacao: body.itemVerificacao.trim(),
      peso: body.peso ?? 1,
      pontosMaximo: Math.round(Number(body.pontosMaximo) || 1),
      ordemExibicao: 0,
      ativo: true,
    })
    .select("id, itemVerificacao, categoriaId, peso, pontosMaximo")
    .single();
  if (errItem) throw new Error(errItem.message);
  // Determinar quais fases vincular
  let faseIdsToLink: string[];
  if (body.faseIds && body.faseIds.length > 0) {
    // Usar fases específicas fornecidas
    faseIdsToLink = body.faseIds;
  } else {
    // Vincular a todas as fases ativas
    const { data: fases } = await supabase
      .from("dim_fases")
      .select("id")
      .eq("ativo", true);
    faseIdsToLink = (fases ?? []).map((f) => f.id);
  }
  
  if (faseIdsToLink.length > 0) {
    await supabase.from("tbl_template_aplicabilidade_fases").insert(
      faseIdsToLink.map((faseId) => ({
        templateItemId: item.id,
        faseId,
        obrigatorio: false,
      }))
    );
  }
  return {
    id: item.id,
    description: item.itemVerificacao,
    categoryId: item.categoriaId,
    auditPhaseId: "",
    weight: item.peso,
    maxPoints: Number(item.pontosMaximo),
  };
}

/** Move um item de verificação para outra categoria. Cria o item para todas as disciplinas da nova categoria. */
export async function moveLibraryVerificationItemToCategory(
  itemId: string,
  newCategoryId: string
): Promise<void> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para mover itens na biblioteca.");

  // Buscar o item atual
  const { data: currentItem, error: itemError } = await supabase
    .from("tbl_checklist_template")
    .select("id, itemVerificacao, categoriaId, disciplinaId, peso, pontosMaximo")
    .eq("id", itemId)
    .eq("ativo", true)
    .single();

  if (itemError || !currentItem) throw new Error("Item não encontrado");

  // Buscar todas as disciplinas vinculadas à nova categoria
  const { data: newCategoryLinks, error: linksError } = await supabase
    .from("dim_categorias_disciplinas")
    .select("disciplinaId")
    .eq("categoriaId", newCategoryId);

  if (linksError) throw new Error(linksError.message);
  if (!newCategoryLinks || newCategoryLinks.length === 0) {
    throw new Error("A nova categoria não está vinculada a nenhuma disciplina.");
  }

  const newDisciplineIds = newCategoryLinks.map((l) => l.disciplinaId);

  // Verificar se já existe item com mesma descrição na nova categoria para cada disciplina
  for (const disciplineId of newDisciplineIds) {
    const { data: existing } = await supabase
      .from("tbl_checklist_template")
      .select("id")
      .eq("disciplinaId", disciplineId)
      .eq("categoriaId", newCategoryId)
      .eq("itemVerificacao", currentItem.itemVerificacao)
      .eq("ativo", true)
      .single();

    if (!existing) {
      // Criar novo item na nova categoria/disciplina
      const { data: newItem, error: createError } = await supabase
        .from("tbl_checklist_template")
        .insert({
          disciplinaId: disciplineId,
          categoriaId: newCategoryId,
          itemVerificacao: currentItem.itemVerificacao,
          peso: currentItem.peso,
          pontosMaximo: currentItem.pontosMaximo,
          ordemExibicao: 0,
          ativo: true,
        })
        .select("id")
        .single();

      if (createError) throw new Error(createError.message);

      // Vincular a todas as fases
      const { data: fases } = await supabase
        .from("dim_fases")
        .select("id")
        .eq("ativo", true);
      const faseIds = (fases ?? []).map((f) => f.id);
      if (faseIds.length > 0 && newItem) {
        await supabase.from("tbl_template_aplicabilidade_fases").insert(
          faseIds.map((faseId) => ({
            templateItemId: newItem.id,
            faseId,
            obrigatorio: false,
          }))
        );
      }
    }
  }

  // Desativar todos os itens com a mesma descrição e categoria antiga (soft delete)
  const { error: deactivateError } = await supabase
    .from("tbl_checklist_template")
    .update({ ativo: false })
    .eq("itemVerificacao", currentItem.itemVerificacao)
    .eq("categoriaId", currentItem.categoriaId)
    .eq("ativo", true);

  if (deactivateError) throw new Error(deactivateError.message);
}

/** Busca as fases aplicáveis a uma categoria (verifica através dos itens da categoria) */
export async function getCategoryPhases(categoryId: string): Promise<string[]> {
  // Buscar fases aplicáveis diretamente através de join com itens da categoria
  const { data: aplicabilidades, error: appError } = await supabase
    .from("tbl_template_aplicabilidade_fases")
    .select("faseId, tbl_checklist_template!inner(categoriaId)")
    .eq("tbl_checklist_template.categoriaId", categoryId)
    .eq("tbl_checklist_template.ativo", true);

  if (appError) {
    // Se não há itens ou aplicabilidades, retornar todas as fases como padrão
    const { data: allPhases } = await supabase
      .from("dim_fases")
      .select("id")
      .eq("ativo", true);
    return (allPhases ?? []).map((p) => p.id);
  }

  // Retornar fases únicas
  const phaseIds = [...new Set((aplicabilidades ?? []).map((a) => a.faseId))];
  
  // Se não há fases aplicáveis, retornar todas como padrão
  if (phaseIds.length === 0) {
    const { data: allPhases } = await supabase
      .from("dim_fases")
      .select("id")
      .eq("ativo", true);
    return (allPhases ?? []).map((p) => p.id);
  }
  
  return phaseIds;
}

/** Busca as fases aplicáveis para todas as categorias de uma vez (otimizado) */
export async function getAllCategoryPhases(categoryIds: string[]): Promise<Map<string, Set<string>>> {
  if (categoryIds.length === 0) return new Map();

  // Buscar todas as fases ativas primeiro
  const { data: allPhases } = await supabase
    .from("dim_fases")
    .select("id")
    .eq("ativo", true);
  const allPhaseIds = (allPhases ?? []).map((p) => p.id);

  // Buscar todos os itens das categorias
  const { data: items, error: itemsError } = await supabase
    .from("tbl_checklist_template")
    .select("id, categoriaId")
    .in("categoriaId", categoryIds)
    .eq("ativo", true);

  if (itemsError || !items || items.length === 0) {
    // Se não há itens, todas as categorias têm todas as fases
    const map = new Map<string, Set<string>>();
    for (const categoryId of categoryIds) {
      map.set(categoryId, new Set(allPhaseIds));
    }
    return map;
  }

  // Buscar aplicabilidades de todos os itens de uma vez
  const itemIds = items.map((i) => i.id);
  const { data: aplicabilidades, error: appError } = await supabase
    .from("tbl_template_aplicabilidade_fases")
    .select("faseId, templateItemId")
    .in("templateItemId", itemIds);

  // Criar mapa itemId -> categoriaId
  const itemToCategory = new Map<string, string>();
  for (const item of items) {
    itemToCategory.set(item.id, item.categoriaId);
  }

  // Agrupar por categoria
  const map = new Map<string, Set<string>>();
  
  // Inicializar todas as categorias com todas as fases (padrão)
  for (const categoryId of categoryIds) {
    map.set(categoryId, new Set(allPhaseIds));
  }

  // Se há aplicabilidades específicas, usar apenas essas
  if (!appError && aplicabilidades && aplicabilidades.length > 0) {
    // Resetar para vazio e preencher apenas com as aplicáveis
    for (const categoryId of categoryIds) {
      map.set(categoryId, new Set());
    }

    // Agrupar fases por categoria
    for (const app of aplicabilidades) {
      const categoryId = itemToCategory.get(app.templateItemId);
      if (categoryId && map.has(categoryId)) {
        map.get(categoryId)!.add(app.faseId);
      }
    }

    // Se alguma categoria ficou sem fases, usar todas como padrão
    for (const categoryId of categoryIds) {
      const phases = map.get(categoryId);
      if (!phases || phases.size === 0) {
        map.set(categoryId, new Set(allPhaseIds));
      }
    }
  }

  return map;
}

/** Atualiza a aplicabilidade de uma categoria para as fases selecionadas */
export async function updateCategoryPhases(categoryId: string, phaseIds: string[]): Promise<void> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para atualizar aplicabilidade.");

  // Buscar todos os itens ativos desta categoria
  const { data: items, error: itemsError } = await supabase
    .from("tbl_checklist_template")
    .select("id")
    .eq("categoriaId", categoryId)
    .eq("ativo", true);

  if (itemsError) throw new Error(itemsError.message);
  if (!items || items.length === 0) {
    throw new Error("Esta categoria não possui itens. Adicione itens antes de configurar aplicabilidade.");
  }

  const itemIds = items.map((i) => i.id);

  // Remover todas as aplicabilidades existentes para estes itens
  const { error: deleteError } = await supabase
    .from("tbl_template_aplicabilidade_fases")
    .delete()
    .in("templateItemId", itemIds);

  if (deleteError) throw new Error(deleteError.message);

  // Adicionar novas aplicabilidades
  if (phaseIds.length > 0) {
    const aplicabilidades = [];
    for (const itemId of itemIds) {
      for (const phaseId of phaseIds) {
        aplicabilidades.push({
          templateItemId: itemId,
          faseId: phaseId,
          obrigatorio: false,
        });
      }
    }

    const { error: insertError } = await supabase
      .from("tbl_template_aplicabilidade_fases")
      .insert(aplicabilidades);

    if (insertError) throw new Error(insertError.message);
  }
}

/** Busca as disciplinas vinculadas a um item de verificação (busca todos os itens com mesma descrição e categoria) */
export async function getItemDisciplines(itemId: string): Promise<{ id: string; name: string }[]> {
  // Buscar o item para obter descrição e categoria
  const { data: currentItem, error: itemError } = await supabase
    .from("tbl_checklist_template")
    .select("itemVerificacao, categoriaId")
    .eq("id", itemId)
    .eq("ativo", true)
    .single();

  if (itemError || !currentItem) throw new Error("Item não encontrado");

  // Buscar todos os itens com mesma descrição e categoria (podem estar em múltiplas disciplinas)
  const { data: items, error } = await supabase
    .from("tbl_checklist_template")
    .select("disciplinaId, dim_disciplinas!inner(id, nome)")
    .eq("itemVerificacao", currentItem.itemVerificacao)
    .eq("categoriaId", currentItem.categoriaId)
    .eq("ativo", true);

  if (error) throw new Error(error.message);

  const disciplineMap = new Map<string, string>();
  for (const item of items ?? []) {
    const disc = item.dim_disciplinas as { id: string; nome: string } | null;
    if (disc && !disciplineMap.has(disc.id)) {
      disciplineMap.set(disc.id, disc.nome);
    }
  }

  return Array.from(disciplineMap.entries()).map(([id, name]) => ({ id, name }));
}

/** Atualiza um item de verificação da biblioteca. Apenas auditor_bim ou admin_bim. */
export async function updateLibraryVerificationItem(
  itemId: string,
  body: { itemVerificacao?: string; peso?: number; pontosMaximo?: number }
): Promise<ChecklistItemRow> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para editar itens da biblioteca.");
  const updates: { itemVerificacao?: string; peso?: number; pontosMaximo?: number } = {};
  if (body.itemVerificacao !== undefined) updates.itemVerificacao = body.itemVerificacao.trim();
  if (body.peso !== undefined) updates.peso = body.peso;
  if (body.pontosMaximo !== undefined) updates.pontosMaximo = Math.round(Number(body.pontosMaximo)) || 1;
  if (Object.keys(updates).length === 0) {
    const { data } = await supabase
      .from("tbl_checklist_template")
      .select("id, itemVerificacao, categoriaId, peso, pontosMaximo")
      .eq("id", itemId)
      .single();
    if (!data) throw new Error("Item não encontrado");
    return {
      id: data.id,
      description: data.itemVerificacao,
      categoryId: data.categoriaId,
      auditPhaseId: "",
      weight: data.peso,
      maxPoints: Number(data.pontosMaximo),
    };
  }
  const { data, error } = await supabase
    .from("tbl_checklist_template")
    .update(updates)
    .eq("id", itemId)
    .select("id, itemVerificacao, categoriaId, peso, pontosMaximo")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    description: data.itemVerificacao,
    categoryId: data.categoriaId,
    auditPhaseId: "",
    weight: data.peso,
    maxPoints: Number(data.pontosMaximo),
  };
}

/** Inativa um item de verificação (soft delete). Apenas auditor_bim ou admin_bim. */
export async function deleteLibraryVerificationItem(itemId: string): Promise<void> {
  const me = await authMe();
  if (me.role === "leitor") throw new Error("Sem permissão para excluir itens da biblioteca.");

  const { error } = await supabase.from("tbl_checklist_template").update({ ativo: false }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

// --- User Management (Admin only) ---
export type UserRow = {
  id: string;
  email: string;
  nomeCompleto: string;
  perfil: "admin_bim" | "auditor_bim" | "leitor";
  authUserId?: string;
  avatarUrl?: string;
  status?: "ativo" | "inativo" | "convite_enviado";
};

/** Lista todos os usuários. Apenas admin_bim. */
export async function listUsers(): Promise<UserRow[]> {
  const me = await authMe();
  if (me.role !== "admin_bim") throw new Error("Apenas administradores podem listar usuários.");

  // Buscar todos os usuários - sem avatar_url pois a coluna pode não existir
  const { data, error } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil, auth_user_id")
    .order("nomeCompleto");

  if (error) {
    console.error("Erro ao listar usuários:", error);
    throw new Error(`Erro ao listar usuários: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn("Nenhum usuário encontrado na tabela dim_usuarios");
    return [];
  }

  return data.map((u) => ({
    id: u.id,
    email: u.email || "",
    nomeCompleto: u.nomeCompleto || "",
    perfil: (u.perfil as "admin_bim" | "auditor_bim" | "leitor") || "auditor_bim",
    authUserId: u.auth_user_id || undefined,
    avatarUrl: undefined, // Coluna não existe ainda
  }));
}

/** Atualiza perfil/permissões de um usuário. Apenas admin_bim. */
export async function updateUserRole(userId: string, perfil: "admin_bim" | "auditor_bim" | "leitor"): Promise<void> {
  const me = await authMe();
  if (me.role !== "admin_bim") throw new Error("Apenas administradores podem alterar permissões.");

  const { error } = await supabase.from("dim_usuarios").update({ perfil }).eq("id", userId);
  if (error) throw new Error(error.message);
}

/** Atualiza nome do usuário. */
export async function updateUserName(userId: string, nomeCompleto: string): Promise<void> {
  const me = await authMe();
  // Usuário só pode atualizar próprio nome, ou admin pode atualizar qualquer um
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: currentUser } = await supabase.from("dim_usuarios").select("id").eq("auth_user_id", user.id).single();
    if (me.role !== "admin_bim" && currentUser?.id !== userId) {
      throw new Error("Você só pode atualizar seu próprio nome.");
    }
  }

  const { error } = await supabase.from("dim_usuarios").update({ nomeCompleto }).eq("id", userId);
  if (error) throw new Error(error.message);
}

/** Atualiza email do usuário via Supabase Auth. */
export async function updateUserEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw new Error(error.message);
}

/** Atualiza senha do usuário via Supabase Auth. */
export async function updateUserPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/** Atualiza avatar do usuário. */
export async function updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
  const me = await authMe();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: currentUser } = await supabase.from("dim_usuarios").select("id").eq("auth_user_id", user.id).single();
    if (me.role !== "admin_bim" && currentUser?.id !== userId) {
      throw new Error("Você só pode atualizar seu próprio avatar.");
    }
  }

  // Nota: avatar_url pode não existir na tabela ainda
  // Por enquanto, apenas logamos o erro se a coluna não existir
  const { error } = await supabase.from("dim_usuarios").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) {
    if (error.message.includes("avatar_url")) {
      console.warn("Coluna avatar_url não existe na tabela. Ignorando atualização.");
      return;
    }
    throw new Error(error.message);
  }
}

/** Retorna descrição das permissões de cada perfil */
export type PermissionInfo = {
  label: string;
  permissions: ScreenId[]; // Agora são IDs de telas
};

/** Telas/páginas disponíveis no sistema */
export const AVAILABLE_SCREENS = [
  { id: "dashboard", label: "Dashboard", description: "Página inicial com visão geral" },
  { id: "obras", label: "Obras", description: "Gerenciamento de obras" },
  { id: "obras_new", label: "Nova Obra", description: "Criar nova obra" },
  { id: "obras_detail", label: "Detalhes da Obra", description: "Visualizar e editar obra" },
  { id: "biblioteca", label: "Biblioteca", description: "Visualizar biblioteca de templates" },
  { id: "biblioteca_manage", label: "Gerenciar Biblioteca", description: "Gerenciar disciplinas, categorias e itens" },
  { id: "biblioteca_new_category", label: "Nova Categoria", description: "Criar nova categoria" },
  { id: "auditorias", label: "Auditorias", description: "Lista de auditorias" },
  { id: "auditorias_new", label: "Nova Auditoria", description: "Criar nova auditoria" },
  { id: "auditorias_detail", label: "Detalhes da Auditoria", description: "Visualizar e gerenciar auditoria" },
  { id: "auditorias_execucao", label: "Execução", description: "Executar auditoria e avaliar itens" },
  { id: "auditorias_ncs", label: "Não Conformidades", description: "Visualizar não conformidades" },
  { id: "relatorios", label: "Relatórios", description: "Lista de relatórios" },
  { id: "relatorios_detail", label: "Detalhes do Relatório", description: "Visualizar relatório completo" },
  { id: "configuracoes", label: "Configurações", description: "Configurações do sistema (apenas admin)" },
  { id: "perfil", label: "Perfil", description: "Gerenciar perfil pessoal" },
] as const;

export type ScreenId = typeof AVAILABLE_SCREENS[number]["id"];

export const PERMISSIONS_INFO: Record<"admin_bim" | "auditor_bim" | "leitor", PermissionInfo> = {
  admin_bim: {
    label: "Administrador",
    permissions: AVAILABLE_SCREENS.map((s) => s.id) as ScreenId[], // Acesso a todas as telas
  },
  auditor_bim: {
    label: "Auditor",
    permissions: [
      "dashboard",
      "obras",
      "biblioteca",
      "biblioteca_manage",
      "biblioteca_new_category",
      "auditorias",
      "auditorias_new",
      "auditorias_detail",
      "auditorias_execucao",
      "auditorias_ncs",
      "relatorios",
      "relatorios_detail",
      "perfil",
    ] as ScreenId[],
  },
  leitor: {
    label: "Leitor",
    permissions: [
      "dashboard",
      "obras",
      "biblioteca",
      "auditorias",
      "auditorias_detail",
      "relatorios",
      "relatorios_detail",
      "perfil",
    ] as ScreenId[],
  },
};

/** Busca permissões salvas do localStorage ou retorna padrão */
export function getPermissionsConfig(): Record<"admin_bim" | "auditor_bim" | "leitor", PermissionInfo> {
  try {
    const saved = localStorage.getItem("bim_audit_permissions_config");
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Record<"admin_bim" | "auditor_bim" | "leitor", PermissionInfo>>;
      // Validar que os screenIds existem
      const validScreenIds = new Set(AVAILABLE_SCREENS.map((s) => s.id));
      const validatePermissions = (perms: string[]): ScreenId[] => {
        return perms.filter((p): p is ScreenId => validScreenIds.has(p as ScreenId)) as ScreenId[];
      };
      // Mesclar com padrão para garantir que todas as permissões existam
      return {
        admin_bim: {
          label: parsed.admin_bim?.label || PERMISSIONS_INFO.admin_bim.label,
          permissions: parsed.admin_bim?.permissions
            ? validatePermissions(parsed.admin_bim.permissions)
            : PERMISSIONS_INFO.admin_bim.permissions,
        },
        auditor_bim: {
          label: parsed.auditor_bim?.label || PERMISSIONS_INFO.auditor_bim.label,
          permissions: parsed.auditor_bim?.permissions
            ? validatePermissions(parsed.auditor_bim.permissions)
            : PERMISSIONS_INFO.auditor_bim.permissions,
        },
        leitor: {
          label: parsed.leitor?.label || PERMISSIONS_INFO.leitor.label,
          permissions: parsed.leitor?.permissions
            ? validatePermissions(parsed.leitor.permissions)
            : PERMISSIONS_INFO.leitor.permissions,
        },
      };
    }
  } catch (error) {
    console.error("Erro ao carregar permissões:", error);
  }
  return PERMISSIONS_INFO;
}

/** Salva configuração de permissões no localStorage */
export function savePermissionsConfig(config: Record<"admin_bim" | "auditor_bim" | "leitor", PermissionInfo>): void {
  try {
    localStorage.setItem("bim_audit_permissions_config", JSON.stringify(config));
  } catch (error) {
    console.error("Erro ao salvar permissões:", error);
    throw new Error("Erro ao salvar configuração de permissões");
  }
}

async function createAudit(body: {
  workId: string;
  phaseId: string;
  disciplineId: string;
  title?: string;
  startDate: string;
  auditorId: string;
}) {
  const me = await authMe();
  const codigoAuditoria = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. Buscar itens do template aplicáveis a esta disciplina e fase
  const { data: templates, error: templatesError } = await supabase
    .from("tbl_checklist_template")
    .select("id, categoriaId, disciplinaId, itemVerificacao, peso, pontosMaximo")
    .eq("ativo", true)
    .eq("disciplinaId", body.disciplineId)
    .order("ordemExibicao", { ascending: true });
  if (templatesError) throw new Error(templatesError.message);

  // Filtrar por fase: itens que têm aplicabilidade para body.phaseId
  const { data: aplicaveis } = await supabase
    .from("tbl_template_aplicabilidade_fases")
    .select("templateItemId")
    .eq("faseId", body.phaseId);
  const faseIds = new Set((aplicaveis ?? []).map((a) => a.templateItemId));
  const templatesFiltrados =
    templates?.filter((t) => faseIds.has(t.id)) ?? templates ?? [];

  if (templatesFiltrados.length === 0) {
    throw new Error("Nenhum item de checklist ativo para esta disciplina e fase. Configure itens no template.");
  }

  // 2. Criar auditoria
  const { data, error } = await supabase
    .from("fato_auditorias")
    .insert({
      codigoAuditoria,
      obraId: body.workId,
      disciplinaId: body.disciplineId,
      faseId: body.phaseId,
      titulo: body.title ?? `Auditoria ${body.startDate}`,
      dataInicio: body.startDate,
      auditorResponsavelId: body.auditorId || me.id,
      status: "nao_iniciado",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // 3. Criar itens da auditoria a partir do template
  const itens = templatesFiltrados.map((t, i) => ({
    auditoriaId: data.id,
    templateItemId: t.id,
    categoriaId: t.categoriaId,
    disciplinaId: t.disciplinaId,
    itemVerificacaoSnapshot: t.itemVerificacao,
    pesoSnapshot: t.peso,
    pontosMaximoSnapshot: t.pontosMaximo,
    ordemExibicao: i,
  }));
  const { error: itensError } = await supabase
    .from("fato_auditoria_itens")
    .insert(itens);
  if (itensError) throw new Error(itensError.message);

  return { id: data.id };
}
