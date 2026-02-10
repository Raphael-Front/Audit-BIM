const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** Server-side: call API with token from cookie (e.g. cookies().get("auth-token")?.value). */
export async function apiServer<T>(path: string, token: string | null | undefined, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
};

export type MeResponse = { id: string; email: string; name: string; role: string };
export function authMe() {
  return api<MeResponse>("/auth/me");
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Credenciais inválidas");
  }
  return res.json() as Promise<LoginResponse>;
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
    document.cookie = `auth-token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    document.cookie = "auth-token=; path=/; max-age=0";
  }
}

export function getTokenFromCookie(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/auth-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function auditsList(params: { workId?: string; phaseId?: string; status?: string; auditorId?: string }) {
  const q = new URLSearchParams();
  if (params.workId) q.set("workId", params.workId);
  if (params.phaseId) q.set("phaseId", params.phaseId);
  if (params.status) q.set("status", params.status);
  if (params.auditorId) q.set("auditorId", params.auditorId);
  const query = q.toString();
  return api<AuditListItem[]>(`/audits${query ? `?${query}` : ""}`);
}

export function auditGet(id: string) {
  return api<AuditDetail>(`/audits/${id}`);
}

export function auditItems(id: string) {
  return api<AuditItemRow[]>(`/audits/${id}/items`);
}

export function auditFinishVerification(id: string) {
  return api<AuditDetail>(`/audits/${id}/finish-verification`, { method: "POST" });
}

export function auditComplete(id: string) {
  return api<AuditDetail>(`/audits/${id}/complete`, { method: "POST" });
}

export function auditCancel(id: string, reason?: string | null) {
  return api<AuditDetail>(`/audits/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export function auditUpdateItem(auditId: string, itemId: string, data: { status?: string; evidenceText?: string; construflowRef?: string }) {
  return api<AuditItemRow>(`/audits/${auditId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Works
export type WorkRow = { id: string; name: string; code: string | null; active: boolean; phases?: { id: string; name: string; order: number }[] };
export function worksList() {
  return api<WorkRow[]>("/works");
}
export function workGet(id: string) {
  return api<WorkRow>(`/works/${id}`);
}
export function workCreate(data: { name: string; code?: string | null }) {
  return api<WorkRow>("/works", { method: "POST", body: JSON.stringify(data) });
}
export function workUpdate(id: string, data: { name?: string; code?: string | null; active?: boolean }) {
  return api<WorkRow>(`/works/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}
export function worksPhases(workId: string) {
  return api<{ id: string; name: string; order: number }[]>(`/works/${workId}/phases`);
}

// Library (disciplines, categories, audit phases, checklist items)
export type AuditPhaseRow = { id: string; name: string; label: string; order: number };
export type DisciplineRow = { id: string; name: string; order: number };
export type CategoryRow = { id: string; name: string; disciplineId: string; order: number };
export type ChecklistItemRow = { id: string; description: string; categoryId: string; auditPhaseId: string; weight: number; maxPoints: number };
export function libraryAuditPhases() {
  return api<AuditPhaseRow[]>("/library/audit-phases");
}
export function libraryDisciplines() {
  return api<DisciplineRow[]>("/library/disciplines");
}
export function libraryCategories(disciplineId?: string) {
  const q = disciplineId ? `?disciplineId=${disciplineId}` : "";
  return api<CategoryRow[]>(`/library/categories${q}`);
}
export function libraryChecklistItems(params?: { categoryId?: string; auditPhaseId?: string }) {
  const q = new URLSearchParams();
  if (params?.categoryId) q.set("categoryId", params.categoryId);
  if (params?.auditPhaseId) q.set("auditPhaseId", params.auditPhaseId);
  const query = q.toString();
  return api<ChecklistItemRow[]>(`/library/checklist-items${query ? `?${query}` : ""}`);
}

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
  checklistItem?: {
    description: string;
    category?: { name: string; discipline?: { name: string } };
  };
  customItem?: { description: string; discipline?: { name: string }; category?: { name: string } };
};
