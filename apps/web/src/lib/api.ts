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

export type MeResponse = { id: string; email: string; name: string; role: string };

export async function authMe(): Promise<MeResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  let dimUser = (await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).single()).data;
  if (!dimUser) {
    await supabase.rpc("ensure_dim_usuario");
    dimUser = (await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).single()).data;
  }
  if (!dimUser) {
    return {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.nome ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "",
      role: "auditor_bim",
    };
  }
  const roleMap: Record<string, string> = { admin_bim: "admin_bim", auditor_bim: "auditor_bim", leitor: "leitor" };
  return { id: dimUser.id, email: dimUser.email, name: dimUser.nomeCompleto, role: roleMap[dimUser.perfil] ?? "auditor_bim" };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message ?? "Credenciais inválidas");

  const user = data.user;
  let dimUser = (await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).single()).data;
  if (!dimUser) {
    await supabase.rpc("ensure_dim_usuario");
    dimUser = (await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).single()).data;
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

export async function worksPhases(_workId: string): Promise<{ id: string; name: string; order: number }[]> {
  const { data, error } = await supabase
    .from("dim_fases")
    .select("id, nome, ordemSequencial")
    .eq("ativo", true)
    .order("ordemSequencial");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.nome, order: r.ordemSequencial }));
}

// --- Library ---
export type AuditPhaseRow = { id: string; name: string; label: string; order: number };
export type DisciplineRow = { id: string; name: string; order: number };
export type CategoryRow = { id: string; name: string; disciplineId: string; order: number };
export type ChecklistItemRow = {
  id: string;
  description: string;
  categoryId: string;
  auditPhaseId: string;
  weight: number;
  maxPoints: number;
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
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r, i) => ({ id: r.id, name: r.nome, order: i }));
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
  categoryId?: string;
  auditPhaseId?: string;
}): Promise<ChecklistItemRow[]> {
  let q = supabase.from("tbl_checklist_template").select("id, itemVerificacao, categoriaId, peso, pontosMaximo").eq("ativo", true);
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
              ? { name: tpl.dim_categorias.nome, discipline: tpl.dim_disciplinas ? { name: tpl.dim_disciplinas.nome } : undefined }
              : undefined,
          }
        : undefined,
      customItem: undefined,
    };
  });
}

export async function auditFinishVerification(id: string): Promise<AuditDetail> {
  const { error } = await supabase
    .from("fato_auditorias")
    .update({ status: "aguardando_apontamentos" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return auditGet(id);
}

export async function auditComplete(id: string): Promise<AuditDetail> {
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

async function createAudit(body: {
  workId: string;
  phaseId: string;
  disciplineId: string;
  auditPhaseId: string;
  title?: string;
  startDate: string;
  auditorId: string;
}) {
  const me = await authMe();
  const codigoAuditoria = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  return { id: data.id };
}
