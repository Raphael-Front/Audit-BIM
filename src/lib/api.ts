/**
 * API via Supabase — substitui a chamada à API NestJS.
 * Auth: Supabase Auth. Dados: PostgREST (dim_obras, fato_auditorias, etc.)
 */
import { createSupabaseClient } from "./supabase/client";
import { logActivityAsync } from "./activityLogger";

const supabase = createSupabaseClient();

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Envolve uma Promise do Supabase com um timeout de 10 segundos.
 * Se a requisição demorar mais que o limite, rejeita com um erro padronizado.
 */
export async function withTimeout<T>(promise: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("TIMEOUT: A requisição demorou mais de 10 segundos. Verifique sua conexão e tente novamente."));
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

/** Formata data YYYY-MM-DD como local (evita bug de fuso horário). */
export function formatDateLocal(dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split(/[-T]/).map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString("pt-BR", options ?? { day: "2-digit", month: "short", year: "numeric" });
}

/** URL base do app para redirects de email (confirmação, recovery). Preferir VITE_APP_URL em produção. */
function getAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

// --- Auth ---
export type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
};

export type MeResponse = { id: string; email: string; name: string; role: string; avatarUrl?: string };

const ANONYMOUS_USER: MeResponse = { id: "", email: "", name: "", role: "leitor" };

/**
 * Lê o usuário autenticado diretamente do localStorage — sem requisição de rede.
 * Nunca vai à rede. Usado para logs de atividade e verificações de role.
 * Retorna ANONYMOUS_USER se não houver sessão no cache (não lança exceção).
 */
function getCachedUser(): MeResponse {
  try {
    // Ler do cache do AuthContext (tem role correto)
    const raw = localStorage.getItem("auditbim:me");
    if (raw) {
      const parsed = JSON.parse(raw) as { userId: string; data: MeResponse };
      if (parsed?.data?.id) return parsed.data;
    }
    // Fallback: ler do token do Supabase no localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const tokenRaw = localStorage.getItem(key);
      if (!tokenRaw) continue;
      const token = JSON.parse(tokenRaw);
      const user = token?.user ?? token?.currentSession?.user;
      if (user?.id) {
        return {
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.nome ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "",
          role: "leitor",
        };
      }
    }
  } catch { /* ignore */ }
  return ANONYMOUS_USER;
}

/** Lê userId e email do localStorage — zero rede. Evita getSession() que dispara refresh_token. */
function getAuthUserId(): { userId: string; email: string } | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem("auditbim:me");
    if (raw) {
      const parsed = JSON.parse(raw) as { userId: string; data: MeResponse };
      if (parsed?.userId && parsed?.data?.id) return { userId: parsed.userId, email: parsed.data.email };
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const tokenRaw = localStorage.getItem(key);
      if (!tokenRaw) continue;
      const token = JSON.parse(tokenRaw);
      const user = token?.user ?? token?.currentSession?.user ?? token?.session?.user;
      if (user?.id) return { userId: user.id, email: user.email ?? "" };
    }
  } catch { /* ignore */ }
  return null;
}

/** Escreve me no cache (auditbim:me) para exibição imediata após login. */
export function prepopulateMeCache(authUserId: string, me: MeResponse): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("auditbim:me", JSON.stringify({ userId: authUserId, data: me }));
  } catch { /* ignore */ }
}

export async function authMe(): Promise<MeResponse> {
  const auth = getAuthUserId();
  if (!auth) throw new Error("Não autenticado");

  const { data: dimUser } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil, avatar_url")
    .eq("auth_user_id", auth.userId)
    .maybeSingle();

  if (dimUser) {
    const roleMap: Record<string, string> = { admin_bim: "admin_bim", auditor_bim: "auditor_bim", leitor: "leitor" };
    return {
      id: dimUser.id,
      email: dimUser.email,
      name: dimUser.nomeCompleto,
      role: roleMap[dimUser.perfil] ?? "leitor",
      avatarUrl: dimUser.avatar_url ?? undefined,
    };
  }

  try { await supabase.rpc("ensure_dim_usuario"); } catch { /* ignore */ }

  const { data: newDimUser } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil, avatar_url")
    .eq("auth_user_id", auth.userId)
    .maybeSingle();

  if (newDimUser) {
    const roleMap: Record<string, string> = { admin_bim: "admin_bim", auditor_bim: "auditor_bim", leitor: "leitor" };
    return {
      id: newDimUser.id,
      email: newDimUser.email,
      name: newDimUser.nomeCompleto,
      role: roleMap[newDimUser.perfil] ?? "leitor",
      avatarUrl: newDimUser.avatar_url ?? undefined,
    };
  }

  return {
    id: auth.userId,
    email: auth.email,
    name: auth.email.split("@")[0] ?? "",
    role: "leitor",
  };
}

export async function register(email: string, password: string, nomeCompleto: string): Promise<LoginResponse> {
  const baseUrl = getAppBaseUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: baseUrl ? `${baseUrl}/auth/callback` : undefined,
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

  const user = data.user;
  let { data: dimUser } = await supabase.from("dim_usuarios").select("id, email, nomeCompleto, perfil").eq("auth_user_id", user.id).maybeSingle();
  if (!dimUser) {
    try {
      await supabase.rpc("ensure_dim_usuario");
    } catch {
      /* Ignorar erro se RPC não existir */
    }
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
      role: dimUser ? (roleMap[dimUser.perfil] ?? "leitor") : "leitor",
    },
  };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message ?? "Credenciais inválidas");

  const user = data.user;
  let u: { id: string; email: string; name: string; role: string };
  try {
    const me = await authMe();
    prepopulateMeCache(user.id, me);
    u = { id: me.id, email: me.email, name: me.name, role: me.role };
  } catch {
    u = {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.nome ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "",
      role: "leitor",
    };
  }
  logActivityAsync({
    userId: u.id,
    userName: u.name,
    userEmail: u.email,
    userRole: u.role,
    action: "LOGIN",
    entity: "USUARIO",
    details: `Login realizado: ${u.email}`,
  });
  return {
    accessToken: data.session?.access_token ?? "",
    user: u,
  };
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    const secure = window.location.protocol === "https:";
    document.cookie = `auth-token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax${secure ? "; Secure" : ""}`;
  }
}

export async function logout() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    document.cookie = "auth-token=; path=/; max-age=0";
  }
}

const FRIENDLY_ABORT_MSG =
  "Sessão expirada ou inválida. Feche outras abas do app, limpe os dados do site no navegador e tente novamente.";

function isAbortOrConnectionError(err: unknown): boolean {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    const name = (err as Error & { name?: string }).name?.toLowerCase() ?? "";
    return (
      name === "aborterror" ||
      m.includes("signal is aborted") ||
      m.includes("aborted") ||
      m.includes("timeout") ||
      m.includes("504") ||
      m.includes("gateway") ||
      m.includes("refresh token")
    );
  }
  return false;
}

/** Solicita recuperação de senha via email. redirectTo usa VITE_APP_URL em produção para o link abrir na sua app. */
export async function forgotPassword(email: string): Promise<void> {
  try {
    const baseUrl = getAppBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "");
    const redirectTo = `${baseUrl}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw new Error(error.message ?? "Erro ao enviar email de recuperação");
  } catch (err) {
    if (isAbortOrConnectionError(err)) {
      throw new Error(FRIENDLY_ABORT_MSG);
    }
    if (err instanceof Error) throw err;
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique se o projeto Supabase está ativo e tente novamente."
    );
  }
}

/** Redefine a senha usando o token do link de recuperação */
export async function resetPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw new Error(error.message ?? "Erro ao redefinir senha");
}

/** Reenvia o email de confirmação para o endereço informado (após signUp com confirmação ativa). */
export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error) throw new Error(error.message ?? "Erro ao reenviar email de confirmação");
}

export function getTokenFromCookie(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/auth-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
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

// --- Dashboard Stats ---
export type DashboardStats = {
  auditsCount: number;
  totalItems: number;
  nextAuditDate: string | null;
  nextAuditSection: string | null;
};

export type WorstDiscipline = { disciplineName: string; errorCount: number };
export type ErrorByCategory = { categoryName: string; major: number; minor: number };

export type DashboardFilters = {
  workId?: string;
  dateFrom?: string;
  dateTo?: string;
};

/** IDs de auditorias não canceladas (sempre exclui cancelada para relatórios e métricas). */
async function getFilteredAuditIds(filters?: DashboardFilters): Promise<string[]> {
  let q = supabase.from("fato_auditorias").select("id").neq("status", "cancelada");
  if (filters?.workId) q = q.eq("obraId", filters.workId);
  if (filters?.dateFrom) q = q.gte("dataInicio", filters.dateFrom);
  if (filters?.dateTo) q = q.lte("dataInicio", filters.dateTo);
  const { data } = await q;
  return (data ?? []).map((r) => r.id);
}

/** Contagem de auditorias próximas (status agendado com data planejada >= hoje). */
export async function notificationsUpcomingCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("fato_auditorias")
    .select("id", { count: "exact", head: true })
    .eq("status", "agendado")
    .gte("dataInicio", today);
  if (error) return 0;
  return count ?? 0;
}

/** Contagem de auditorias em atraso (status agendado com data planejada no passado). */
export async function notificationsOverdueCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("fato_auditorias")
    .select("id", { count: "exact", head: true })
    .eq("status", "agendado")
    .lt("dataInicio", today);
  if (error) return 0;
  return count ?? 0;
}

/** Contagem de auditorias em andamento (qualquer status exceto agendado, concluida e cancelada). */
export async function notificationsPendingCount(): Promise<number> {
  const { count, error } = await supabase
    .from("fato_auditorias")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("agendado","concluida","cancelada")');
  if (error) return 0;
  return count ?? 0;
}

export async function dashboardStats(filters?: DashboardFilters): Promise<DashboardStats> {
  const today = new Date().toISOString().slice(0, 10);
  const auditIds = await getFilteredAuditIds(filters);

  // Montar queries de contagem de auditorias e próxima auditoria
  let auditsQuery = supabase.from("fato_auditorias").select("id", { count: "exact", head: true }).neq("status", "cancelada");
  if (filters?.workId) auditsQuery = auditsQuery.eq("obraId", filters.workId);
  if (filters?.dateFrom) auditsQuery = auditsQuery.gte("dataInicio", filters.dateFrom);
  if (filters?.dateTo) auditsQuery = auditsQuery.lte("dataInicio", filters.dateTo);

  let nextQuery = supabase
    .from("fato_auditorias")
    .select("dataInicio, dim_fases!fato_auditorias_faseId_fkey(nome), dim_disciplinas!fato_auditorias_disciplinaId_fkey(nome)")
    .gte("dataInicio", today)
    .neq("status", "concluida")
    .neq("status", "cancelada");
  if (filters?.workId) nextQuery = nextQuery.eq("obraId", filters.workId);
  if (filters?.dateFrom) nextQuery = nextQuery.gte("dataInicio", filters.dateFrom);
  if (filters?.dateTo) nextQuery = nextQuery.lte("dataInicio", filters.dateTo);

  // Montar query de contagem de itens (auditIds sempre exclui cancelada)
  const buildItemsQuery = () => {
    if (auditIds.length === 0) return null;
    return supabase.from("fato_auditoria_itens").select("id", { count: "exact", head: true }).in("auditoriaId", auditIds);
  };
  const itemsQuery = buildItemsQuery();

  // Executar todas as queries em paralelo
  const [auditsRes, itemsRes, nextRes] = await Promise.all([
    auditsQuery,
    itemsQuery ? itemsQuery : Promise.resolve({ count: 0, data: null, error: null }),
    nextQuery.order("dataInicio", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const auditsCount = (auditsRes as { count?: number }).count ?? 0;
  const itemsCount = (itemsRes as { count?: number | null }).count ?? 0;
  const next = nextRes.data as { dataInicio: string; dim_fases?: { nome: string }; dim_disciplinas?: { nome: string } } | null;
  return {
    auditsCount,
    totalItems: itemsCount,
    nextAuditDate: next?.dataInicio ?? null,
    nextAuditSection: next?.dim_disciplinas?.nome ?? next?.dim_fases?.nome ?? null,
  };
}

export async function dashboardWorstDisciplines(limit = 5, filters?: DashboardFilters): Promise<WorstDiscipline[]> {
  const auditIds = await getFilteredAuditIds(filters);
  if (auditIds.length === 0) return [];

  let query = supabase
    .from("fato_auditoria_itens")
    .select("disciplinaId, dim_disciplinas!fato_auditoria_itens_disciplinaId_fkey(nome)")
    .eq("status", "nao_conforme")
    .in("auditoriaId", auditIds);
  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const byDiscipline = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    const disc = row.dim_disciplinas as { nome: string } | null;
    const name = disc?.nome ?? "Sem disciplina";
    const id = (row.disciplinaId as string) ?? "";
    if (!byDiscipline.has(id)) byDiscipline.set(id, { name, count: 0 });
    byDiscipline.get(id)!.count += 1;
  }

  return Array.from(byDiscipline.values())
    .map((v) => ({ disciplineName: v.name, errorCount: v.count }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, limit);
}

export async function dashboardErrorsByCategory(filters?: DashboardFilters): Promise<ErrorByCategory[]> {
  const auditIds = await getFilteredAuditIds(filters);
  if (auditIds.length === 0) return [];

  let query = supabase
    .from("fato_auditoria_itens")
    .select("categoriaId, status, dim_categorias!fato_auditoria_itens_categoriaId_fkey(nome)")
    .eq("status", "nao_conforme")
    .in("auditoriaId", auditIds);
  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const byCategory = new Map<string, { name: string; major: number; minor: number }>();
  for (const row of data ?? []) {
    const cat = row.dim_categorias as { nome: string } | null;
    const name = cat?.nome ?? "Sem categoria";
    const id = (row.categoriaId as string) ?? "";
    if (!byCategory.has(id)) byCategory.set(id, { name, major: 0, minor: 0 });
    byCategory.get(id)!.major += 1;
  }

  return Array.from(byCategory.values())
    .map((v) => ({ categoryName: v.name, major: v.major, minor: v.minor }))
    .sort((a, b) => b.major + b.minor - (a.major + a.minor));
}

export type WorkByScore = {
  workId: string;
  workName: string;
  totalAuditorias: number;
  scoreMedio: number;
  scoreMedioUltimoMes: number | null;
  tendencia: "up" | "down" | "stable";
};

/** Retorna o score médio de uma obra (tbl_scores_por_obra). Usado para consistência com o Relatório Geral. */
export async function workScoreByWorkId(workId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("tbl_scores_por_obra")
    .select("scoreMedio")
    .eq("obraId", workId)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.scoreMedio ?? 0);
}

/** Retorna obras com score médio. Usa cálculo em tempo real (evita dados zerados de tbl_scores_por_obra). */
export async function dashboardWorksByScore(filters?: DashboardFilters): Promise<WorkByScore[]> {
  return dashboardWorksByScoreFallback(filters);
}

const BATCH_SIZE = 150;

/** Fallback: calcula score médio em tempo real (evita dados zerados de tbl_scores_por_obra) */
async function dashboardWorksByScoreFallback(filters?: DashboardFilters): Promise<WorkByScore[]> {
  let q = supabase
    .from("fato_auditorias")
    .select("id, obraId, dataInicio")
    .neq("status", "cancelada")
    .limit(10000);
  if (filters?.workId) q = q.eq("obraId", filters.workId);
  if (filters?.dateFrom) q = q.gte("dataInicio", filters.dateFrom);
  if (filters?.dateTo) q = q.lte("dataInicio", filters.dateTo);
  const { data: auditsData } = await q;

  if (!auditsData?.length) return [];

  const auditIds = auditsData.map((a) => a.id);
  const auditInfo = new Map<string, { obraId: string; dataInicio: string }>();
  for (const a of auditsData) {
    const obraId = a.obraId as string;
    if (obraId) auditInfo.set(a.id, { obraId, dataInicio: (a.dataInicio as string) ?? "" });
  }

  const scoreByAudit = new Map<string, number>();
  for (let i = 0; i < auditIds.length; i += BATCH_SIZE) {
    const chunk = auditIds.slice(i, i + BATCH_SIZE);
    const { data: scoresData } = await supabase
      .from("tbl_scores_calculados")
      .select("auditoriaId, scoreGeral, totalConforme, totalAplicavel")
      .in("auditoriaId", chunk);
    for (const s of scoresData ?? []) {
      const scoreGeral = Number(s.scoreGeral ?? 0);
      const totalConforme = s.totalConforme ?? 0;
      const totalAplicavel = s.totalAplicavel ?? 0;
      if (scoreGeral === 0 && totalConforme > 0 && totalAplicavel > 0) continue;
      scoreByAudit.set(s.auditoriaId, Math.min(100, scoreGeral));
    }
  }

  const needsFallback = auditIds.filter((id) => !scoreByAudit.has(id));
  if (needsFallback.length > 0) {
    const byAudit = new Map<string, { obtidos: number; max: number }>();
    for (let i = 0; i < needsFallback.length; i += BATCH_SIZE) {
      const chunk = needsFallback.slice(i, i + BATCH_SIZE);
      const { data: itensData } = await supabase
        .from("fato_auditoria_itens")
        .select("auditoriaId, status, pontosObtidos, pontosMaximoSnapshot")
        .in("auditoriaId", chunk)
        .limit(50000);
      for (const it of itensData ?? []) {
        if (!byAudit.has(it.auditoriaId)) byAudit.set(it.auditoriaId, { obtidos: 0, max: 0 });
        const st = it.status as string;
        if (st === "nao_aplicavel") continue;
        const acc = byAudit.get(it.auditoriaId)!;
        acc.obtidos += Number(it.pontosObtidos ?? 0);
        acc.max += Number(it.pontosMaximoSnapshot ?? 10);
      }
    }
    for (const [audId, v] of byAudit) {
      const score = v.max > 0 ? Math.min(100, Math.round((v.obtidos / v.max) * 100)) : 0;
      scoreByAudit.set(audId, score);
    }
  }

  const umMesAtras = new Date();
  umMesAtras.setDate(umMesAtras.getDate() - 30);
  const dataLimiteUltimoMes = umMesAtras.toISOString().slice(0, 10);

  const byObra = new Map<string, { scores: number[]; scoresUltimoMes: number[] }>();
  for (const a of auditsData) {
    const info = auditInfo.get(a.id);
    if (!info) continue;
    const score = scoreByAudit.get(a.id) ?? 0;
    if (!byObra.has(info.obraId)) byObra.set(info.obraId, { scores: [], scoresUltimoMes: [] });
    const cur = byObra.get(info.obraId)!;
    cur.scores.push(score);
    if (info.dataInicio >= dataLimiteUltimoMes) cur.scoresUltimoMes.push(score);
  }

  const obraIds = Array.from(byObra.keys());
  if (obraIds.length === 0) return [];

  const { data: obrasData } = await supabase
    .from("dim_obras")
    .select("id, nome")
    .in("id", obraIds);
  const obraNames = new Map<string, string>();
  for (const o of obrasData ?? []) {
    obraNames.set(o.id, (o.nome as string) ?? "Sem nome");
  }

  return Array.from(byObra.entries()).map(([id, v]) => {
    const count = v.scores.length;
    const scoreMedio = count > 0 ? v.scores.reduce((a, b) => a + b, 0) / count : 0;
    const countUltimoMes = v.scoresUltimoMes.length;
    const scoreMedioUltimoMes =
      countUltimoMes > 0 ? v.scoresUltimoMes.reduce((a, b) => a + b, 0) / countUltimoMes : null;
    let tendencia: "up" | "down" | "stable" = "stable";
    if (scoreMedioUltimoMes != null && countUltimoMes >= 3) {
      if (scoreMedioUltimoMes > scoreMedio) tendencia = "up";
      else if (scoreMedioUltimoMes < scoreMedio) tendencia = "down";
    }
    return {
      workId: id,
      workName: obraNames.get(id) ?? "Sem nome",
      totalAuditorias: count,
      scoreMedio: Math.round(scoreMedio * 10) / 10,
      scoreMedioUltimoMes: scoreMedioUltimoMes != null ? Math.round(scoreMedioUltimoMes * 10) / 10 : null,
      tendencia,
    };
  });
}

// --- Works (dim_obras) ---
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
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "CREATE",
      entity: "OBRA",
      entityId: data.id,
      entityName: data.nome,
      details: `Obra criada: ${data.nome}`,
      newValue: { nome: data.nome, codigo: data.codigo },
    });
  } catch {
    /* ignore */
  }
  return toWorkRow(data);
}

export async function workUpdate(
  id: string,
  payload: { name?: string; active?: boolean }
): Promise<WorkRow> {
  const { data: before } = await supabase.from("dim_obras").select("nome, codigo, ativo").eq("id", id).single();
  const updates: Record<string, unknown> = {};
  if (payload.name != null) updates.nome = payload.name;
  /* codigo é imutável - nunca atualizado */
  if (payload.active !== undefined) updates.ativo = payload.active;
  const { data, error } = await supabase
    .from("dim_obras")
    .update(updates)
    .eq("id", id)
    .select("id, nome, codigo, ativo")
    .single();
  if (error) throw new Error(error.message);
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "OBRA",
      entityId: id,
      entityName: data.nome,
      details: `Obra atualizada: ${data.nome}`,
      previousValue: before ? { nome: before.nome, codigo: before.codigo, ativo: before.ativo } : undefined,
      newValue: { nome: data.nome, codigo: data.codigo, ativo: data.ativo },
    });
  } catch {
    /* ignore */
  }
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
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "BIBLIOTECA",
      entityId: disciplineId,
      entityName: body.name,
      details: `Disciplina atualizada: ${body.name}`,
      newValue: { nome: body.name, codigo },
    });
  } catch {
    /* ignore */
  }
  return { id: data.id, name: data.nome, code: data.codigo ?? null, order: 0 };
}

/** Exclui (desativa) uma disciplina */
export async function deleteLibraryDiscipline(disciplineId: string): Promise<void> {
  const me = getCachedUser();
  if (me.role === "leitor") throw new Error("Sem permissão para excluir disciplinas.");
  const { data: disc } = await supabase.from("dim_disciplinas").select("nome").eq("id", disciplineId).single();
  const { error } = await supabase
    .from("dim_disciplinas")
    .update({ ativo: false })
    .eq("id", disciplineId);
  if (error) throw new Error(error.message);
  logActivityAsync({
    userId: me.id,
    userName: me.name,
    userEmail: me.email,
    userRole: me.role,
    action: "DELETE",
    entity: "BIBLIOTECA",
    entityId: disciplineId,
    entityName: disc?.nome ?? undefined,
    details: `Disciplina excluída (desativada): ${disc?.nome ?? disciplineId}`,
  });
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

/** Retorna a categoria "Outros" vinculada à disciplina. Usa RPC que cria categoria/vínculo se não existirem. */
export async function libraryGetOutrosCategory(disciplineId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.rpc("get_or_create_outros_category", {
    p_disciplina_id: disciplineId,
  });
  if (error) {
    const fallback = await libraryGetOutrosCategoryFallback(disciplineId);
    return fallback;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  return { id: row.id, name: row.nome ?? "Outros" };
}

async function libraryGetOutrosCategoryFallback(disciplineId: string): Promise<{ id: string; name: string } | null> {
  const { data: cat } = await supabase
    .from("dim_categorias")
    .select("id, nome")
    .or("codigo.eq.OUTROS,nome.eq.Outros")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (!cat) return null;
  const { data: link } = await supabase
    .from("dim_categorias_disciplinas")
    .select("categoriaId")
    .eq("categoriaId", cat.id)
    .eq("disciplinaId", disciplineId)
    .maybeSingle();
  return link ? { id: cat.id, name: cat.nome } : null;
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

// --- Status labels para auditorias ---
export const AUDIT_STATUS_LABELS: Record<string, string> = {
  planejada: "Planejada",
  nao_iniciado: "Não iniciado",
  agendado: "Agendado",
  em_atraso: "Em atraso",
  em_andamento: "Em andamento",
  aguardando_apontamentos: "Aguardando apontamentos",
  concluida: "Concluída",
  cancelada: "Cancelada",
  pausada: "Pausada",
};

/** Retorna o status efetivo para exibição: "em_atraso" se agendado com data planejada no passado. */
export function getDisplayStatus(audit: { status: string; startDate?: string; plannedDate?: string }): string {
  const status = audit.status;
  const plannedDate = audit.plannedDate ?? audit.startDate ?? "";
  if (status === "agendado" && plannedDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (plannedDate < today) return "em_atraso";
  }
  return status;
}

/** Classe CSS do badge por status de auditoria (usa globals.css) */
export const AUDIT_STATUS_BADGE_CLASS: Record<string, string> = {
  nao_iniciado: "badge-status-nao-iniciado",
  agendado: "badge-status-agendado",
  em_atraso: "badge-status-em-atraso",
  em_andamento: "badge-status-em-andamento",
  aguardando_apontamentos: "badge-status-aguardando-apontamentos",
  concluida: "badge-status-concluida",
  cancelada: "badge-status-cancelada",
  pausada: "badge-status-pausada",
};

// --- Audits ---
export type AuditListItem = {
  id: string;
  title: string;
  status: string;
  work?: { name: string; code?: string | null };
  phase?: { name: string; code?: string | null };
  discipline?: { name: string; code?: string | null };
  auditPhase?: { name: string; label: string };
  auditor?: { name: string };
  /** Data planejada para a auditoria (dataInicio) */
  startDate: string;
  /** Código da auditoria (ex: R70-HIN-LO) */
  code?: string;
  /** Data planejada (igual a startDate, para uso em colunas) */
  plannedDate?: string;
  /** Data de criação do registro */
  createdDate?: string;
  /** Score da auditoria (0–100) */
  score?: number;
  /** Quantidade de itens conformes */
  conformes?: number;
  /** Quantidade de itens não conformes */
  naoConformes?: number;
  /** Quantidade de itens pendentes (não avaliados) */
  pendentes?: number;
};

export type AuditDetail = {
  id: string;
  title: string;
  status: string;
  disciplineId?: string;
  work?: { name: string; code?: string | null };
  phase?: { name: string; code?: string | null };
  discipline?: { name: string; code?: string | null };
  auditPhase?: { name: string; label: string };
  auditor?: { name: string };
  startDate: string;
  endDate?: string | null;
};

export type EvidenciaAnexo = {
  id: string;
  arquivoNome: string;
  arquivoUrl: string; // path no storage, usar createSignedUrl para exibir/baixar
  arquivoTipo: string;
};

export type AuditItemRow = {
  id: string;
  status: string;
  evidenceText?: string | null;
  construflowRef?: string | null;
  nextReviewAt?: string | null;
  anexos?: EvidenciaAnexo[];
  checklistItem?: { description: string; category?: { name: string; id?: string; discipline?: { name: string } } };
  customItem?: { description: string; discipline?: { name: string }; category?: { name: string } };
  /** ID da categoria (para modal de item personalizado) */
  categoryId?: string;
};

/** Retorna mensagem detalhada com categorias e itens que faltam preenchimento obrigatório */
export function buildNcsIncompletosMessage(items: AuditItemRow[]): string {
  if (!items?.length) return "";
  const getCategoryName = (item: AuditItemRow) =>
    item.checklistItem?.category?.name ?? item.customItem?.category?.name ?? "Sem categoria";
  const getItemDesc = (item: AuditItemRow) => {
    const d = item.checklistItem?.description ?? item.customItem?.description ?? item.id;
    return typeof d === "string" ? (d.length > 80 ? d.slice(0, 80) + "…" : d) : String(d);
  };
  const byCat = items.reduce<Record<string, string[]>>((acc, item) => {
    const cat = getCategoryName(item);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(getItemDesc(item));
    return acc;
  }, {});
  return Object.entries(byCat)
    .map(([cat, descs]) => `${cat}: ${descs.join("; ")}`)
    .join(" | ");
}

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
  createdAt?: string | null;
  dim_obras?: { nome: string; codigo?: string | null } | null;
  dim_fases?: { nome: string; codigo?: string | null } | null;
  dim_disciplinas?: { nome: string; codigo?: string | null } | null;
  dim_usuarios?: { nomeCompleto: string } | null;
}): AuditListItem {
  const dataInicio = (a.dataInicio ?? "").toString().slice(0, 10);
  const createdDate = a.createdAt ? String(a.createdAt).slice(0, 10) : undefined;
  return {
    id: a.id,
    title: a.titulo ?? a.codigoAuditoria,
    status: a.status,
    work: a.dim_obras ? { name: a.dim_obras.nome, code: a.dim_obras.codigo ?? null } : undefined,
    phase: a.dim_fases ? { name: a.dim_fases.nome, code: a.dim_fases.codigo ?? null } : undefined,
    discipline: a.dim_disciplinas ? { name: a.dim_disciplinas.nome, code: a.dim_disciplinas.codigo ?? null } : undefined,
    auditPhase: a.dim_fases ? { name: a.dim_fases.nome, label: a.dim_fases.codigo ?? a.dim_fases.nome } : undefined,
    auditor: a.dim_usuarios ? { name: a.dim_usuarios.nomeCompleto } : undefined,
    startDate: dataInicio,
    code: a.codigoAuditoria,
    plannedDate: dataInicio,
    createdDate,
  };
}

export function auditsList(params: {
  workId?: string;
  phaseId?: string;
  disciplineId?: string;
  status?: string;
  /** Exclui auditorias com esse status (ex: "cancelada" para relatórios) */
  excludeStatus?: string;
  auditorId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdueFilter = params.status === "em_atraso";

  let q = supabase
    .from("fato_auditorias")
    .select(`
      id, titulo, codigoAuditoria, status, dataInicio, createdAt,
      dim_obras!fato_auditorias_obraId_fkey(nome, codigo),
      dim_fases!fato_auditorias_faseId_fkey(nome, codigo),
      dim_disciplinas!fato_auditorias_disciplinaId_fkey(nome, codigo),
      dim_usuarios!fato_auditorias_auditorResponsavelId_fkey(nomeCompleto)
    `)
    .order("createdAt", { ascending: false });
  if (params.workId) q = q.eq("obraId", params.workId);
  if (params.phaseId) q = q.eq("faseId", params.phaseId);
  if (params.disciplineId) q = q.eq("disciplinaId", params.disciplineId);
  if (isOverdueFilter) {
    q = q.eq("status", "agendado").lt("dataInicio", today);
  } else if (params.status) {
    q = q.eq("status", params.status);
  }
  if (params.excludeStatus) q = q.neq("status", params.excludeStatus);
  if (params.auditorId) q = q.eq("auditorResponsavelId", params.auditorId);
  if (params.dateFrom) q = q.gte("dataInicio", params.dateFrom);
  if (params.dateTo) q = q.lte("dataInicio", params.dateTo);
  return q.then(async ({ data, error }) => {
    if (error) throw new Error(error.message);
    const audits = (data ?? []).map((a: Record<string, unknown>) =>
      toAuditListItem({
        id: a.id as string,
        titulo: a.titulo as string | null,
        codigoAuditoria: a.codigoAuditoria as string,
        status: a.status as string,
        dataInicio: a.dataInicio as string,
        createdAt: a.createdAt as string | null,
        dim_obras: a.dim_obras as { nome: string; codigo?: string | null } | null,
        dim_fases: a.dim_fases as { nome: string; codigo?: string | null } | null,
        dim_disciplinas: a.dim_disciplinas as { nome: string; codigo?: string | null } | null,
        dim_usuarios: a.dim_usuarios as { nomeCompleto: string } | null,
      })
    );

    const auditIds = audits.map((a) => a.id);
    if (auditIds.length === 0) return audits;

    // Buscar scores do cache; se vazio, calcular a partir dos itens
    let scoresMap = new Map<
      string,
      { score: number; conformes: number; naoConformes: number; pendentes: number }
    >();

    const { data: scoresData } = await supabase
      .from("tbl_scores_calculados")
      .select("auditoriaId, scoreGeral, totalConforme, totalNaoConforme, totalAplicavel")
      .in("auditoriaId", auditIds);

    if (scoresData && scoresData.length > 0) {
      for (const s of scoresData) {
        const scoreGeral = Number(s.scoreGeral ?? 0);
        const totalConforme = s.totalConforme ?? 0;
        const totalAplicavel = s.totalAplicavel ?? 0;
        // Cache inconsistente: score 0 com itens conformes -> recalcular dos itens
        if (scoreGeral === 0 && totalConforme > 0 && totalAplicavel > 0) continue;
        const pendentes = Math.max(
          0,
          totalAplicavel - totalConforme - (s.totalNaoConforme ?? 0)
        );
        scoresMap.set(s.auditoriaId, {
          score: Math.min(100, scoreGeral),
          conformes: totalConforme,
          naoConformes: s.totalNaoConforme ?? 0,
          pendentes,
        });
      }
    }
    const needsFallback = auditIds.filter((id) => !scoresMap.has(id));
    if (needsFallback.length > 0) {
      // Fallback: agregar a partir de fato_auditoria_itens (ou cache inconsistente)
      const { data: itensData } = await supabase
        .from("fato_auditoria_itens")
        .select("auditoriaId, status, pontosObtidos, pontosMaximoSnapshot")
        .in("auditoriaId", needsFallback);

      const byAudit = new Map<string, Array<{ status: string; obtidos: number; max: number }>>();
      for (const it of itensData ?? []) {
        if (!byAudit.has(it.auditoriaId)) byAudit.set(it.auditoriaId, []);
        byAudit.get(it.auditoriaId)!.push({
          status: it.status,
          obtidos: Number(it.pontosObtidos ?? 0),
          max: Number(it.pontosMaximoSnapshot ?? 10),
        });
      }

      for (const [audId, itens] of byAudit) {
        const aplicaveis = itens.filter((i) => i.status !== "nao_aplicavel");
        const conformes = itens.filter((i) => i.status === "conforme" || i.status === "corrigido").length;
        const naoConformes = itens.filter((i) => i.status === "nao_conforme").length;
        const pendentes = Math.max(0, aplicaveis.length - conformes - naoConformes);
        let totalPossivel = 0;
        let totalObtido = 0;
        for (const i of aplicaveis) {
          totalPossivel += i.max;
          if (i.status === "conforme" || i.status === "corrigido") totalObtido += i.max;
          else if (i.status === "nao_conforme") totalObtido += 0;
          else totalObtido += i.obtidos; // nao_iniciado ou outro: usa valor salvo
        }
        const score = totalPossivel > 0 ? Math.min(100, Math.round((totalObtido / totalPossivel) * 100)) : 0;
        scoresMap.set(audId, { score, conformes, naoConformes, pendentes });
      }
    }

    return audits.map((a) => {
      const sc = scoresMap.get(a.id);
      if (!sc) return a;
      return { ...a, score: sc.score, conformes: sc.conformes, naoConformes: sc.naoConformes, pendentes: sc.pendentes };
    });
  });
}

export async function auditGet(id: string): Promise<AuditDetail> {
  const { data, error } = await supabase
    .from("fato_auditorias")
    .select(`
      id, titulo, codigoAuditoria, status, dataInicio, dataFimPrevista, dataConclusao, disciplinaId,
      dim_obras!fato_auditorias_obraId_fkey(nome, codigo),
      dim_fases!fato_auditorias_faseId_fkey(nome, codigo),
      dim_disciplinas!fato_auditorias_disciplinaId_fkey(nome, codigo),
      dim_usuarios!fato_auditorias_auditorResponsavelId_fkey(nomeCompleto)
    `)
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Auditoria não encontrada");
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "VIEW",
      entity: "AUDITORIA",
      entityId: data.id,
      entityName: data.titulo ?? data.codigoAuditoria,
      details: `Visualização da auditoria: ${data.titulo ?? data.codigoAuditoria}`,
    });
  } catch {
    /* ignore */
  }
  return {
    id: data.id,
    title: data.titulo ?? data.codigoAuditoria,
    status: data.status,
    disciplineId: data.disciplinaId ?? undefined,
    work: data.dim_obras ? { name: data.dim_obras.nome, code: data.dim_obras.codigo ?? null } : undefined,
    phase: data.dim_fases ? { name: data.dim_fases.nome, code: data.dim_fases.codigo ?? null } : undefined,
    discipline: data.dim_disciplinas ? { name: data.dim_disciplinas.nome, code: data.dim_disciplinas.codigo ?? null } : undefined,
    auditPhase: data.dim_fases ? { name: data.dim_fases.nome, label: data.dim_fases.codigo ?? data.dim_fases.nome } : undefined,
    auditor: data.dim_usuarios ? { name: data.dim_usuarios.nomeCompleto } : undefined,
    startDate: data.dataInicio,
    endDate: data.dataConclusao ?? data.dataFimPrevista ?? null,
  };
}

/** Atualiza a data planejada (dataInicio) da auditoria */
export async function auditUpdateSchedule(id: string, startDate: string): Promise<AuditDetail> {
  const dataInicio = String(startDate).slice(0, 10);
  const { error } = await supabase
    .from("fato_auditorias")
    .update({ dataInicio })
    .eq("id", id);
  if (error) throw new Error(error.message);
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "AUDITORIA",
      entityId: id,
      entityName: "",
      details: `Data de agendamento alterada para ${dataInicio}`,
    });
  } catch {
    /* ignore */
  }
  return auditGet(id);
}

export async function auditItems(id: string): Promise<AuditItemRow[]> {
  const { data, error } = await supabase
    .from("fato_auditoria_itens")
    .select(`
      id, status, evidenciaObservacao, codigoConstruflow, proximaRevisao, categoriaId, itemVerificacaoSnapshot,
      tbl_checklist_template!fato_auditoria_itens_templateItemId_fkey(itemVerificacao, dim_categorias(nome, dim_disciplinas(nome))),
      categoria_direta:dim_categorias!fato_auditoria_itens_categoriaId_fkey(nome)
    `)
    .eq("auditoriaId", id)
    .order("ordemExibicao");
  if (error) throw new Error(error.message);
  const items = (data ?? []) as Array<Record<string, unknown> & { id: string }>;
  const itemIds = items.map((i) => i.id);
  let anexosMap: Record<string, EvidenciaAnexo[]> = {};
  if (itemIds.length > 0) {
    const { data: anexosData } = await supabase
      .from("tbl_evidencias_anexos")
      .select("id, auditoriaItemId, arquivoNome, arquivoUrl, arquivoTipo")
      .in("auditoriaItemId", itemIds);
    if (anexosData) {
      anexosMap = (anexosData as Array<{ id: string; auditoriaItemId: string; arquivoNome: string; arquivoUrl: string; arquivoTipo: string }>).reduce(
        (acc, a) => {
          if (!acc[a.auditoriaItemId]) acc[a.auditoriaItemId] = [];
          acc[a.auditoriaItemId].push({ id: a.id, arquivoNome: a.arquivoNome, arquivoUrl: a.arquivoUrl, arquivoTipo: a.arquivoTipo });
          return acc;
        },
        {} as Record<string, EvidenciaAnexo[]>
      );
    }
  }
  return items.map((r) => {
    const tpl = r.tbl_checklist_template as { itemVerificacao: string; dim_categorias?: { nome: string; dim_disciplinas?: { nome: string } } } | null;
    const dimCat = r.categoria_direta as { nome: string } | null;
    const dbStatus = r.status as string;
    const catId = r.categoriaId as string | undefined;
    const snapshotDesc = r.itemVerificacaoSnapshot as string | undefined;
    const isCustom = !tpl && snapshotDesc;
    return {
      id: r.id,
      status: STATUS_FROM_DB[dbStatus] ?? dbStatus,
      evidenceText: (r.evidenciaObservacao as string | null) ?? null,
      construflowRef: (r.codigoConstruflow as string | null) ?? null,
      nextReviewAt: (r.proximaRevisao as string | null) ?? null,
      anexos: anexosMap[r.id] ?? [],
      categoryId: catId,
      checklistItem: tpl
        ? {
            description: tpl.itemVerificacao,
            category: tpl.dim_categorias
              ? { name: tpl.dim_categorias.nome, id: catId, discipline: tpl.dim_categorias.dim_disciplinas ? { name: tpl.dim_categorias.dim_disciplinas.nome } : undefined }
              : undefined,
          }
        : undefined,
      // Itens importados (personalizado): sempre exibir descrição, mesmo se categoria_direta falhar
      customItem: isCustom ? { description: snapshotDesc ?? "", category: { name: dimCat?.nome ?? "Sem categoria" } } : undefined,
    };
  }).filter((row) => {
    const desc = row.checklistItem?.description ?? row.customItem?.description ?? "";
    return desc.trim().toLowerCase() !== "n/a";
  });
}

export type AuditItemCounts = {
  total: number;
  conforme: number;
  naoConforme: number;
  pendente: number;
};

/** Retorna contagem de itens por status para múltiplas auditorias (para exibição em listas) */
export async function auditItemsCountsByAuditIds(
  auditIds: string[]
): Promise<Record<string, AuditItemCounts>> {
  if (auditIds.length === 0) return {};
  const { data, error } = await supabase
    .from("fato_auditoria_itens")
    .select("auditoriaId, status")
    .in("auditoriaId", auditIds)
    .limit(10000); /* evita limite padrão de 1000 linhas do PostgREST */
  if (error) throw new Error(error.message);
  const result: Record<string, AuditItemCounts> = {};
  for (const id of auditIds) {
    result[id] = { total: 0, conforme: 0, naoConforme: 0, pendente: 0 };
  }
  for (const row of data ?? []) {
    const id = row.auditoriaId as string;
    const status = row.status as string;
    const mapped = STATUS_FROM_DB[status] ?? status;
    if (!result[id]) result[id] = { total: 0, conforme: 0, naoConforme: 0, pendente: 0 };
    result[id].total += 1;
    if (mapped === "CONFORMING" || mapped === "CORRIGIDO") result[id].conforme += 1;
    else if (mapped === "NONCONFORMING") result[id].naoConforme += 1;
    else if (mapped === "NOT_STARTED") result[id].pendente += 1;
  }
  return result;
}

/** Itens da auditoria com pontos e disciplina para relatório e score */
export async function auditItemsForReport(id: string): Promise<AuditReportItemRow[]> {
  const { data, error } = await supabase
    .from("fato_auditoria_itens")
    .select(`
      id, status, evidenciaObservacao, codigoConstruflow, proximaRevisao, pontosMaximoSnapshot, pontosObtidos, disciplinaId, itemVerificacaoSnapshot, categoriaId,
      dim_disciplinas!fato_auditoria_itens_disciplinaId_fkey(nome),
      dim_categorias!fato_auditoria_itens_categoriaId_fkey(nome),
      tbl_checklist_template!fato_auditoria_itens_templateItemId_fkey(itemVerificacao, dim_categorias(nome, dim_disciplinas(nome)))
    `)
    .eq("auditoriaId", id)
    .order("ordemExibicao");
  if (error) throw new Error(error.message);
  const items = (data ?? []) as Array<Record<string, unknown> & { id: string }>;
  const itemIds = items.map((i) => i.id);
  let anexosMap: Record<string, EvidenciaAnexo[]> = {};
  if (itemIds.length > 0) {
    const { data: anexosData } = await supabase
      .from("tbl_evidencias_anexos")
      .select("id, auditoriaItemId, arquivoNome, arquivoUrl, arquivoTipo")
      .in("auditoriaItemId", itemIds);
    if (anexosData) {
      anexosMap = (anexosData as Array<{ id: string; auditoriaItemId: string; arquivoNome: string; arquivoUrl: string; arquivoTipo: string }>).reduce(
        (acc, a) => {
          if (!acc[a.auditoriaItemId]) acc[a.auditoriaItemId] = [];
          acc[a.auditoriaItemId].push({ id: a.id, arquivoNome: a.arquivoNome, arquivoUrl: a.arquivoUrl, arquivoTipo: a.arquivoTipo });
          return acc;
        },
        {} as Record<string, EvidenciaAnexo[]>
      );
    }
  }
  return items.map((r) => {
    const tpl = r.tbl_checklist_template as { itemVerificacao: string; dim_categorias?: { nome: string; dim_disciplinas?: { nome: string } } } | null;
    const dbStatus = r.status as string;
    const disc = r.dim_disciplinas as { nome: string } | null;
    const catDirect = r.dim_categorias as { nome: string } | null;
    const snapshotDesc = (r.itemVerificacaoSnapshot as string) || null;
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
      anexos: anexosMap[r.id] ?? [],
      checklistItem: tpl
        ? {
            description: tpl.itemVerificacao,
            category: tpl.dim_categorias
              ? { name: tpl.dim_categorias.nome, discipline: tpl.dim_categorias.dim_disciplinas ? { name: tpl.dim_categorias.dim_disciplinas.nome } : undefined }
              : undefined,
          }
        : snapshotDesc
        ? {
            description: snapshotDesc,
            category: catDirect ? { name: catDirect.nome } : undefined,
          }
        : undefined,
      customItem: undefined,
    };
  });
}

/** Pontos efetivos por item conforme FR-14: conforme/corrigido = 100%, não conforme = 0%, N/A excluído */
function pontosEfetivosPorStatus(item: AuditReportItemRow): number {
  if (item.status === "NA") return 0;
  if (item.status === "CONFORMING" || item.status === "CORRIGIDO") return item.pontosMaximo;
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
  const scoreGeral = pontosPossiveis > 0 ? Math.min(100, Math.round((pontosObtidos / pontosPossiveis) * 100 * 100) / 100) : 0;
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
  const totalConforme = items.filter((i) => i.status === "CONFORMING" || i.status === "CORRIGIDO").length;
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
  try {
    const me = getCachedUser();
    const detail = await auditGet(id);
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "AUDITORIA",
      entityId: id,
      entityName: detail.title,
      details: "Auditoria: finalização da verificação",
      newValue: { status: "aguardando_apontamentos" },
    });
  } catch {
    /* ignore */
  }
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
  try {
    const me = getCachedUser();
    const detail = await auditGet(id);
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "AUDITORIA",
      entityId: id,
      entityName: detail.title,
      details: "Auditoria concluída",
      newValue: { status: "concluida" },
    });
  } catch {
    /* ignore */
  }
  return auditGet(id);
}

export async function auditCancel(id: string, reason?: string | null): Promise<AuditDetail> {
  const me = getCachedUser();
  // canceladoPorId deve referenciar dim_usuarios.id; getCachedUser() pode retornar auth.users.id
  let canceladoPorId: string | null = null;
  if (me.id) {
    const { data: dimUser } = await supabase
      .from("dim_usuarios")
      .select("id")
      .or(`id.eq.${me.id},auth_user_id.eq.${me.id}`)
      .maybeSingle();
    canceladoPorId = dimUser?.id ?? null;
  }
  const { error } = await supabase
    .from("fato_auditorias")
    .update({
      status: "cancelada",
      motivoCancelamento: reason ?? null,
      canceladoPorId,
      canceladoEm: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  try {
    const detail = await auditGet(id);
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "DELETE",
      entity: "AUDITORIA",
      entityId: id,
      entityName: detail.title,
      details: `Auditoria cancelada${reason ? `: ${reason}` : ""}`,
      newValue: { status: "cancelada", motivoCancelamento: reason ?? null },
    });
  } catch {
    /* ignore */
  }
  return auditGet(id);
}

const STATUS_TO_DB: Record<string, string> = {
  NOT_STARTED: "nao_iniciado",
  CONFORMING: "conforme",
  NONCONFORMING: "nao_conforme",
  OBSERVATION: "nao_aplicavel",
  NA: "nao_aplicavel",
  CORRIGIDO: "corrigido",
};
const STATUS_FROM_DB: Record<string, string> = {
  nao_iniciado: "NOT_STARTED",
  conforme: "CONFORMING",
  nao_conforme: "NONCONFORMING",
  nao_aplicavel: "NA",
  corrigido: "CORRIGIDO",
};

export async function auditUpdateItem(
  auditId: string,
  itemId: string,
  payload: { status?: string; evidenceText?: string; construflowRef?: string }
): Promise<AuditItemRow> {
  // Ao editar item em auditoria concluída, reabre para em_andamento (mostra Finalizar verificação)
  const { data: auditRow } = await supabase.from("fato_auditorias").select("status").eq("id", auditId).single();
  if (auditRow?.status === "concluida") {
    const { error: auditErr } = await supabase
      .from("fato_auditorias")
      .update({ status: "em_andamento" })
      .eq("id", auditId);
    if (auditErr) throw new Error(auditErr.message ?? "Erro ao reabrir auditoria");
  }

  const updates: Record<string, unknown> = {};
  if (payload.status != null) updates.status = STATUS_TO_DB[payload.status] ?? payload.status;
  if (payload.evidenceText != null) updates.evidenciaObservacao = payload.evidenceText;
  if (payload.construflowRef != null) updates.codigoConstruflow = payload.construflowRef;

  if (payload.status != null) {
    const resolvedStatus = (STATUS_TO_DB[payload.status] ?? payload.status) as string;
    const isConformeOuCorrigido = ["conforme", "corrigido", "CONFORMING", "CORRIGIDO"].includes(resolvedStatus);
    if (isConformeOuCorrigido) {
      const { data: item } = await supabase
        .from("fato_auditoria_itens")
        .select("pontosMaximoSnapshot")
        .eq("id", itemId)
        .eq("auditoriaId", auditId)
        .single();
      updates.pontosObtidos = Number(item?.pontosMaximoSnapshot ?? 10);
    } else {
      updates.pontosObtidos = 0;
    }
  }

  const { error } = await supabase.from("fato_auditoria_itens").update(updates).eq("id", itemId).eq("auditoriaId", auditId);
  if (error) throw new Error(error.message);
  const items = await auditItems(auditId);
  const found = items.find((i) => i.id === itemId);
  if (!found) throw new Error("Item não encontrado");
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "AUDITORIA",
      entityId: auditId,
      entityName: undefined,
      details: `Item de auditoria atualizado: status ${payload.status ?? "evidência/ref"}`,
      newValue: payload,
    });
  } catch {
    /* ignore */
  }
  return found;
}

/** Adiciona um item personalizado à auditoria. */
export async function auditAddCustomItem(
  auditId: string,
  payload: { description: string; categoryId: string }
): Promise<AuditItemRow> {
  const me = getCachedUser();
  const audit = await auditGet(auditId);
  const status = audit.status as string;
  const allowed = ["nao_iniciado", "agendado", "planejada", "em_andamento", "aguardando_apontamentos"];
  if (!allowed.includes(status)) {
    throw new Error("Itens personalizados só podem ser adicionados antes da conclusão ou cancelamento da auditoria.");
  }
  const disciplineId = audit.disciplineId;
  if (!disciplineId) {
    throw new Error("Auditoria sem disciplina definida.");
  }

  // Verificar se a categoria pertence à disciplina
  const { data: link, error: linkErr } = await supabase
    .from("dim_categorias_disciplinas")
    .select("categoriaId, disciplinaId")
    .eq("categoriaId", payload.categoryId)
    .eq("disciplinaId", disciplineId)
    .maybeSingle();
  if (linkErr || !link) {
    throw new Error("Categoria não encontrada ou não pertence à disciplina da auditoria.");
  }

  const peso = 1;
  const pontosMaximo = 10;

  // Obter a maior ordemExibicao atual
  const { data: maxOrder } = await supabase
    .from("fato_auditoria_itens")
    .select("ordemExibicao")
    .eq("auditoriaId", auditId)
    .order("ordemExibicao", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordemExibicao = (maxOrder?.ordemExibicao ?? -1) + 1;

  const { data: newItem, error: insertItemErr } = await supabase
    .from("fato_auditoria_itens")
    .insert({
      auditoriaId: auditId,
      templateItemId: null,
      categoriaId: payload.categoryId,
      disciplinaId: disciplineId,
      itemVerificacaoSnapshot: payload.description.trim(),
      pesoSnapshot: peso,
      pontosMaximoSnapshot: pontosMaximo,
      tipoItem: "personalizado",
      status: "nao_iniciado",
      ordemExibicao,
    })
    .select("id")
    .single();
  if (insertItemErr || !newItem) {
    throw new Error(insertItemErr?.message ?? "Erro ao criar item de auditoria.");
  }

  const { error: insertPersErr } = await supabase.from("tbl_itens_personalizados_salvos").insert({
    auditoriaItemId: newItem.id,
    disciplinaId: disciplineId,
    categoriaId: payload.categoryId,
    itemVerificacao: payload.description.trim(),
    peso,
    pontosMaximo,
    criadoPorId: me.id,
  });
  if (insertPersErr) {
    await supabase.from("fato_auditoria_itens").delete().eq("id", newItem.id);
    throw new Error(insertPersErr.message ?? "Erro ao registrar item personalizado.");
  }

  try {
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "CREATE",
      entity: "AUDITORIA",
      entityId: auditId,
      entityName: audit.title,
      details: `Item personalizado adicionado: ${payload.description.trim().slice(0, 80)}`,
      newValue: { itemId: newItem.id, description: payload.description, categoryId: payload.categoryId },
    });
  } catch {
    /* ignore */
  }

  const items = await auditItems(auditId);
  const created = items.find((i) => i.id === newItem.id);
  if (!created) {
    return {
      id: newItem.id,
      status: "NOT_STARTED",
      checklistItem: undefined,
      customItem: { description: payload.description.trim(), category: { name: "" } },
    };
  }
  return created;
}

const BUCKET_EVIDENCIAS = "audit-evidencias";
const BUCKET_AVATARES = "avatars";
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024; // 10MB

/** Upload de imagem de evidência para item não conforme. Retorna o anexo criado. */
export async function auditUploadEvidence(
  auditId: string,
  itemId: string,
  file: File
): Promise<EvidenciaAnexo> {
  const allowed = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowed.includes(file.type)) {
    throw new Error("Formato não permitido. Use JPG, PNG ou PDF.");
  }
  if (file.size > MAX_EVIDENCE_SIZE) {
    throw new Error(`Arquivo muito grande. Máximo ${MAX_EVIDENCE_SIZE / 1024 / 1024}MB.`);
  }
  const me = getCachedUser();
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storagePath = `${itemId}/${filename}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET_EVIDENCIAS).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message ?? "Erro ao enviar arquivo.");

  const fileUrl = storagePath;

  const { data: row, error: insertError } = await supabase
    .from("tbl_evidencias_anexos")
    .insert({
      auditoriaItemId: itemId,
      arquivoNome: file.name,
      arquivoUrl: fileUrl,
      arquivoTipo: file.type,
      arquivoTamanhoBytes: file.size,
      uploadedPorId: me.id,
    })
    .select("id, arquivoNome, arquivoUrl, arquivoTipo")
    .single();
  if (insertError) {
    await supabase.storage.from(BUCKET_EVIDENCIAS).remove([storagePath]);
    throw new Error(insertError.message ?? "Erro ao registrar evidência.");
  }
  return {
    id: row.id,
    arquivoNome: row.arquivoNome,
    arquivoUrl: row.arquivoUrl,
    arquivoTipo: row.arquivoTipo,
  };
}

/** Gera URL assinada para visualização/download da evidência (bucket privado). Expira em 1h. */
export async function auditEvidenceSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_EVIDENCIAS).createSignedUrl(storagePath, 3600);
  if (error) throw new Error(error.message ?? "Erro ao obter URL da evidência.");
  return data.signedUrl;
}

/** Exclui um anexo de evidência (remove do banco e do storage). */
export async function auditDeleteEvidence(anexoId: string, storagePath: string): Promise<void> {
  const { error: deleteDbError } = await supabase
    .from("tbl_evidencias_anexos")
    .delete()
    .eq("id", anexoId);
  if (deleteDbError) throw new Error(deleteDbError.message ?? "Erro ao excluir evidência.");
  await supabase.storage.from(BUCKET_EVIDENCIAS).remove([storagePath]);
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
      dateFrom: u.searchParams.get("dateFrom") ?? undefined,
      dateTo: u.searchParams.get("dateTo") ?? undefined,
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
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "BIBLIOTECA",
      entityId: categoryId,
      entityName: body.name,
      details: `Categoria atualizada: ${body.name}`,
      newValue: { nome: body.name, codigo },
    });
  } catch {
    /* ignore */
  }
  return { id: data.id, name: data.nome, disciplineId: "", order: data.ordemExibicao };
}

/** Exclui (desativa) uma categoria */
export async function deleteLibraryCategory(categoryId: string): Promise<void> {
  const me = getCachedUser();
  if (me.role === "leitor") throw new Error("Sem permissão para excluir categorias.");
  const { data: cat } = await supabase.from("dim_categorias").select("nome").eq("id", categoryId).single();
  const { error } = await supabase
    .from("dim_categorias")
    .update({ ativo: false })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);
  logActivityAsync({
    userId: me.id,
    userName: me.name,
    userEmail: me.email,
    userRole: me.role,
    action: "DELETE",
    entity: "BIBLIOTECA",
    entityId: categoryId,
    entityName: cat?.nome ?? undefined,
    details: `Categoria excluída (desativada): ${cat?.nome ?? categoryId}`,
  });
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
  const me = getCachedUser();
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
  const me = getCachedUser();
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
  try {
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "CREATE",
      entity: "BIBLIOTECA",
      entityId: item.id,
      entityName: item.itemVerificacao,
      details: `Item de verificação criado: ${item.itemVerificacao}`,
      newValue: { itemVerificacao: item.itemVerificacao, categoriaId: item.categoriaId },
    });
  } catch {
    /* ignore */
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
  const me = getCachedUser();
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
  const me = getCachedUser();
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
  const me = getCachedUser();
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
  try {
    const me = getCachedUser();
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "BIBLIOTECA",
      entityId: itemId,
      entityName: data.itemVerificacao,
      details: `Item de verificação atualizado: ${data.itemVerificacao}`,
      newValue: body,
    });
  } catch {
    /* ignore */
  }
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
  const me = getCachedUser();
  if (me.role === "leitor") throw new Error("Sem permissão para excluir itens da biblioteca.");
  const { data: item } = await supabase.from("tbl_checklist_template").select("itemVerificacao").eq("id", itemId).single();
  const { error } = await supabase.from("tbl_checklist_template").update({ ativo: false }).eq("id", itemId);
  if (error) throw new Error(error.message);
  logActivityAsync({
    userId: me.id,
    userName: me.name,
    userEmail: me.email,
    userRole: me.role,
    action: "DELETE",
    entity: "BIBLIOTECA",
    entityId: itemId,
    entityName: item?.itemVerificacao ?? undefined,
    details: `Item de verificação excluído: ${item?.itemVerificacao ?? itemId}`,
  });
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

/** Resolve o role atual do usuário, buscando no banco se o cache não tiver admin_bim. */
async function resolveCurrentRole(): Promise<MeResponse> {
  const cached = getCachedUser();
  if (cached.role === "admin_bim") return cached;

  const auth = getAuthUserId();
  if (!auth) return cached;

  const { data: dimUser } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil, avatar_url")
    .eq("auth_user_id", auth.userId)
    .maybeSingle();

  if (dimUser) {
    const roleMap: Record<string, string> = { admin_bim: "admin_bim", auditor_bim: "auditor_bim", leitor: "leitor" };
    const fresh: MeResponse = {
      id: dimUser.id,
      email: dimUser.email,
      name: dimUser.nomeCompleto,
      role: roleMap[dimUser.perfil] ?? "leitor",
      avatarUrl: dimUser.avatar_url ?? undefined,
    };
    try { localStorage.setItem("auditbim:me", JSON.stringify({ userId: auth.userId, data: fresh })); } catch {}
    return fresh;
  }

  return cached;
}

/** Lista todos os usuários. Apenas admin_bim. */
export async function listUsers(): Promise<UserRow[]> {
  const me = await resolveCurrentRole();
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
    perfil: (u.perfil as "admin_bim" | "auditor_bim" | "leitor") || "leitor",
    authUserId: u.auth_user_id || undefined,
    avatarUrl: undefined, // Coluna não existe ainda
  }));
}

/** Atualiza perfil/permissões de um usuário. Apenas admin_bim. */
export async function updateUserRole(userId: string, perfil: "admin_bim" | "auditor_bim" | "leitor"): Promise<void> {
  const me = await resolveCurrentRole();
  if (me.role !== "admin_bim") throw new Error("Apenas administradores podem alterar permissões.");
  const { data: target } = await supabase.from("dim_usuarios").select("nomeCompleto, perfil").eq("id", userId).single();
  const { error } = await supabase.from("dim_usuarios").update({ perfil }).eq("id", userId);
  if (error) throw new Error(error.message);
  logActivityAsync({
    userId: me.id,
    userName: me.name,
    userEmail: me.email,
    userRole: me.role,
    action: "UPDATE",
    entity: "USUARIO",
    entityId: userId,
    entityName: target?.nomeCompleto ?? undefined,
    details: `Perfil alterado para ${perfil}: ${target?.nomeCompleto ?? userId}`,
    previousValue: target ? { perfil: target.perfil } : undefined,
    newValue: { perfil },
  });
}

/** Atualiza nome do usuário. */
export async function updateUserName(userId: string, nomeCompleto: string): Promise<void> {
  const me = getCachedUser();
  // Usuário só pode atualizar próprio nome, ou admin pode atualizar qualquer um
  if (me.role !== "admin_bim" && me.id !== userId) {
    throw new Error("Você só pode atualizar seu próprio nome.");
  }

  const { data: target } = await supabase.from("dim_usuarios").select("nomeCompleto").eq("id", userId).single();
  const { error } = await supabase.from("dim_usuarios").update({ nomeCompleto }).eq("id", userId);
  if (error) throw new Error(error.message);
  try {
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "UPDATE",
      entity: "USUARIO",
      entityId: userId,
      entityName: target?.nomeCompleto ?? nomeCompleto,
      details: `Nome do usuário atualizado: ${nomeCompleto}`,
      previousValue: target ? { nomeCompleto: target.nomeCompleto } : undefined,
      newValue: { nomeCompleto },
    });
  } catch {
    /* ignore */
  }
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

/** Faz upload do avatar para o Storage e retorna a URL pública. */
export async function uploadAvatarToStorage(file: File): Promise<string> {
  const auth = getAuthUserId();
  if (!auth) throw new Error("Não autenticado.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  if (!["jpeg", "jpg", "png", "gif", "webp"].includes(ext)) {
    throw new Error("Formato inválido. Use JPG, PNG, GIF ou WebP.");
  }
  if (file.size > 2 * 1024 * 1024) throw new Error("Arquivo muito grande. Máximo 2MB.");
  const path = `${auth.userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_AVATARES).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(error.message ?? "Erro ao enviar imagem.");
  const { data: urlData } = supabase.storage.from(BUCKET_AVATARES).getPublicUrl(path);
  return urlData.publicUrl;
}

/** Atualiza avatar do usuário (recebe URL do Storage, não base64). */
export async function updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
  const me = getCachedUser();
  // Usuário só pode atualizar o próprio avatar (me.id vem de authMe já autenticado)
  if (me.role !== "admin_bim" && me.id !== userId) {
    throw new Error("Você só pode atualizar seu próprio avatar.");
  }

  const { error } = await supabase.from("dim_usuarios").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) {
    if (error.message.includes("avatar_url") || error.message.includes("column")) {
      throw new Error("A coluna avatar_url não existe. Execute a migração 013_add_avatar_url_to_dim_usuarios.");
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
    if (typeof window === "undefined") return PERMISSIONS_INFO;
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

// --- Activity Logs (Admin only) ---
export type ActivityLogRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  entity_name: string | null;
  details: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type ActivityLogsParams = {
  search?: string;
  actions?: string[];
  entities?: string[];
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
  orderBy?: "created_at" | "user_name" | "action" | "entity" | "details";
  orderDir?: "asc" | "desc";
  /** Se true, busca até 1999 registros para exportação CSV */
  forExport?: boolean;
};

export type ActivityLogsResponse = {
  logs: ActivityLogRow[];
  total: number;
};

/** Limite padrão de registros por página na tela */
const LOGS_DISPLAY_LIMIT = 50;

/** Limite máximo na visualização do site (últimos 300 para não ficar pesado) */
const LOGS_VIEW_LIMIT = 300;

/** Limite máximo para exportação CSV */
const LOGS_EXPORT_LIMIT = 1999;

/** Lista logs de atividades com filtros e paginação. Apenas admin_bim. */
/** No site: 50 por página, máximo 300 registros visíveis. Exportação CSV: até 1999. */
export async function listActivityLogs(params: ActivityLogsParams = {}): Promise<ActivityLogsResponse> {
  const me = await resolveCurrentRole();
  if (me.role !== "admin_bim") throw new Error("Apenas administradores podem visualizar logs de atividades.");

  const forExport = params.forExport ?? false;
  const page = forExport ? 1 : Math.max(1, params.page ?? 1);
  const perPage = forExport ? LOGS_EXPORT_LIMIT : Math.min(100, Math.max(1, params.perPage ?? LOGS_DISPLAY_LIMIT));
  const orderBy = params.orderBy ?? "created_at";
  const orderDir = params.orderDir ?? "desc";

  const selectCols = "id, user_id, user_name, user_email, user_role, action, entity, entity_id, entity_name, details, previous_value, new_value, ip, user_agent, created_at";

  // Exportação CSV: busca direta até 1999 registros
  if (forExport) {
    let q = supabase.from("tbl_activity_logs").select(selectCols);
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      q = q.or(`user_name.ilike.${term},details.ilike.${term},entity_name.ilike.${term}`);
    }
    if (params.actions?.length) q = q.in("action", params.actions);
    if (params.entities?.length) q = q.in("entity", params.entities);
    if (params.userId) q = q.eq("user_id", params.userId);
    if (params.dateFrom) q = q.gte("created_at", `${params.dateFrom}T00:00:00.000Z`);
    if (params.dateTo) q = q.lte("created_at", `${params.dateTo}T23:59:59.999Z`);
    q = q.order(orderBy, { ascending: orderDir === "asc" });
    const { data, error } = await q.range(0, perPage - 1);
    if (error) throw new Error(error.message);
    return { logs: (data ?? []) as ActivityLogRow[], total: (data ?? []).length };
  }

  // Visualização no site: limitada aos últimos 300 registros
  let idsQuery = supabase.from("tbl_activity_logs").select("id");
  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    idsQuery = idsQuery.or(`user_name.ilike.${term},details.ilike.${term},entity_name.ilike.${term}`);
  }
  if (params.actions?.length) idsQuery = idsQuery.in("action", params.actions);
  if (params.entities?.length) idsQuery = idsQuery.in("entity", params.entities);
  if (params.userId) idsQuery = idsQuery.eq("user_id", params.userId);
  if (params.dateFrom) idsQuery = idsQuery.gte("created_at", `${params.dateFrom}T00:00:00.000Z`);
  if (params.dateTo) idsQuery = idsQuery.lte("created_at", `${params.dateTo}T23:59:59.999Z`);
  idsQuery = idsQuery.order("created_at", { ascending: false });
  const { data: idsData, error: idsError } = await idsQuery.range(0, LOGS_VIEW_LIMIT - 1);

  if (idsError) throw new Error(idsError.message);
  const ids = (idsData ?? []).map((r) => r.id);
  if (ids.length === 0) return { logs: [], total: 0 };

  let dataQuery = supabase
    .from("tbl_activity_logs")
    .select(selectCols)
    .in("id", ids);
  dataQuery = dataQuery.order(orderBy, { ascending: orderDir === "asc" });
  const from = (page - 1) * perPage;
  const { data, error } = await dataQuery.range(from, from + perPage - 1);

  if (error) throw new Error(error.message);
  return {
    logs: (data ?? []) as ActivityLogRow[],
    total: ids.length,
  };
}

export type ActivityLogsStats = {
  actionsToday: number;
  mostActiveUserLast7Days: string;
  deletionsLast30Days: number;
  loginsLast24h: number;
};

/** Estatísticas para painel de logs. Apenas admin_bim. */
export async function activityLogsStats(): Promise<ActivityLogsStats> {
  const me = await resolveCurrentRole();
  if (me.role !== "admin_bim") throw new Error("Apenas administradores podem visualizar estatísticas de logs.");

  const today = new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00.000Z`;
  const todayEnd = `${today}T23:59:59.999Z`;
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [todayRes, loginsRes, deletionsRes, activeRes] = await Promise.all([
    supabase.from("tbl_activity_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("tbl_activity_logs").select("id", { count: "exact", head: true }).eq("action", "LOGIN").gte("created_at", last24h),
    supabase.from("tbl_activity_logs").select("id", { count: "exact", head: true }).eq("action", "DELETE").gte("created_at", last30Days),
    supabase.from("tbl_activity_logs").select("user_name").gte("created_at", last7Days),
  ]);

  const logs = (activeRes.data ?? []) as { user_name: string | null }[];
  const byUser = new Map<string, number>();
  for (const row of logs) {
    const n = row.user_name ?? "Desconhecido";
    byUser.set(n, (byUser.get(n) ?? 0) + 1);
  }
  const mostActive = Array.from(byUser.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return {
    actionsToday: todayRes.count ?? 0,
    mostActiveUserLast7Days: mostActive,
    deletionsLast30Days: deletionsRes.count ?? 0,
    loginsLast24h: loginsRes.count ?? 0,
  };
}

export { logActivityAsync } from "./activityLogger";

async function createAudit(body: {
  workId: string;
  phaseId: string;
  disciplineId: string;
  title?: string;
  startDate: string;
  auditorId: string;
  endDate?: string;
  observacoesGerais?: string;
  scheduled?: boolean;
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
  let templatesFiltrados =
    templates?.filter((t) => faseIds.has(t.id)) ?? templates ?? [];

  // Excluir itens da categoria "Outros" — ela só deve aparecer quando o usuário adicionar item personalizado
  const outrosCat = await libraryGetOutrosCategory(body.disciplineId);
  if (outrosCat) {
    templatesFiltrados = templatesFiltrados.filter((t) => t.categoriaId !== outrosCat.id);
  }
  // Excluir itens com descrição "N/A" (bug/placeholder)
  templatesFiltrados = templatesFiltrados.filter((t) => (t.itemVerificacao ?? "").trim().toLowerCase() !== "n/a");

  if (templatesFiltrados.length === 0) {
    throw new Error("Nenhum item de checklist ativo para esta disciplina e fase. Configure itens no template.");
  }

  // 2. Criar auditoria
  const status = body.scheduled ? "agendado" : "nao_iniciado";
  const dataInicio = String(body.startDate).slice(0, 10);
  const insertPayload: Record<string, unknown> = {
    codigoAuditoria,
    obraId: body.workId,
    disciplinaId: body.disciplineId,
    faseId: body.phaseId,
    titulo: body.title ?? `Auditoria ${dataInicio}`,
    dataInicio,
    auditorResponsavelId: body.auditorId || me.id,
    status,
  };
  if (body.endDate) insertPayload.dataFimPrevista = String(body.endDate).slice(0, 10);
  if (body.observacoesGerais != null && body.observacoesGerais.trim() !== "") insertPayload.observacoesGerais = body.observacoesGerais.trim();

  const { data, error } = await supabase
    .from("fato_auditorias")
    .insert(insertPayload as Record<string, unknown>)
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

  try {
    logActivityAsync({
      userId: me.id,
      userName: me.name,
      userEmail: me.email,
      userRole: me.role,
      action: "CREATE",
      entity: "AUDITORIA",
      entityId: data.id,
      entityName: body.title ?? `Auditoria ${body.startDate}`,
      details: `Auditoria criada: ${body.title ?? body.startDate}`,
      newValue: { obraId: body.workId, disciplinaId: body.disciplineId, faseId: body.phaseId },
    });
  } catch {
    /* ignore */
  }
  return { id: data.id };
}
