"use client";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { MeResponse } from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  me: MeResponse | null;
  reloadMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  status: "loading",
  session: null,
  user: null,
  me: null,
  reloadMe: async () => {},
});

const supabase = createSupabaseClient();
const ME_CACHE_KEY = "auditbim:me";

// ─── Cache do perfil (localStorage persiste entre reloads) ───────────────────

function readMeCache(userId: string): MeResponse | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId: string; data: MeResponse };
    if (parsed?.userId !== userId || !parsed?.data?.role) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeMeCache(userId: string, data: MeResponse) {
  try {
    localStorage.setItem(ME_CACHE_KEY, JSON.stringify({ userId, data }));
  } catch {}
}

function clearMeCache() {
  try {
    localStorage.removeItem(ME_CACHE_KEY);
  } catch {}
}

// ─── Leitura síncrona da sessão Supabase do localStorage (zero rede) ─────────
// O Supabase v2 salva a sessão na chave "sb-<project-ref>-auth-token"
// Evita getSession() que tem 20-100ms de latência (bug conhecido supabase/supabase-js#970)

interface StorageSession {
  userId: string;
  email: string;
  userMetadata: Record<string, unknown>;
}

function readSupabaseSession(): StorageSession | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const user =
        parsed?.user ??
        parsed?.currentSession?.user ??
        parsed?.session?.user;
      if (user?.id) {
        return {
          userId: user.id,
          email: user.email ?? "",
          userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
        };
      }
    }
  } catch {}
  return null;
}

/** Lê Session e User do localStorage (zero rede). Usado para hidratação inicial. */
function readSessionAndUserFromStorage(): { session: Session | null; user: User | null } {
  if (typeof window === "undefined" || !window.localStorage) return { session: null, user: null };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const sessionObj = parsed?.currentSession ?? parsed?.session ?? parsed;
      const u = sessionObj?.user ?? parsed?.user;
      if (u?.id) {
        const session = sessionObj?.access_token
          ? (sessionObj as Session)
          : parsed?.access_token
            ? ({ ...parsed, user: u } as Session)
            : null;
        return { session: session ?? null, user: u as User };
      }
    }
  } catch {}
  return { session: null, user: null };
}

// ─── Busca do perfil completo no banco ───────────────────────────────────────

async function fetchMe(userId: string): Promise<MeResponse | null> {
  const { data: dimUser } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil, avatar_url")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (dimUser) {
    return toMeResponse(dimUser);
  }

  // Usuário novo: garantir criação do registro
  try { await supabase.rpc("ensure_dim_usuario"); } catch {}

  const { data: created } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto, perfil, avatar_url")
    .eq("auth_user_id", userId)
    .maybeSingle();

  return created ? toMeResponse(created) : null;
}

/** updateUser dentro do fluxo de onAuthStateChange causa loop de TOKEN_REFRESHED.
 *  Removido syncProfileToUserMetadata — role instantâneo depende do cache (auditbim:me). */

function toMeResponse(row: {
  id: string;
  email: string;
  nomeCompleto: string;
  perfil: string;
  avatar_url?: string | null;
}): MeResponse {
  const roleMap: Record<string, string> = {
    admin_bim: "admin_bim",
    auditor_bim: "auditor_bim",
    leitor: "leitor",
  };
  return {
    id: row.id,
    email: row.email,
    name: row.nomeCompleto,
    role: roleMap[row.perfil] ?? "leitor",
    avatarUrl: row.avatar_url ?? undefined,
  };
}

function buildFallback(userId: string, email: string, meta: Record<string, unknown>): MeResponse {
  const roleFromMeta = meta?.perfil ?? meta?.role;
  const role =
    roleFromMeta && ["admin_bim", "auditor_bim", "leitor"].includes(String(roleFromMeta))
      ? String(roleFromMeta)
      : "leitor";
  return {
    id: userId,
    email,
    name: String(meta?.nome ?? meta?.name ?? email.split("@")[0] ?? ""),
    role,
    // avatarUrl só vem de cache ou fetchMe — não de user_metadata (evita quota)
  };
}

// ─── Leitura do estado do storage (só no cliente, após mount) ─────────────────
// Não usar no estado inicial: server não tem localStorage → causaria hydration mismatch.

function getStateFromStorage(): {
  status: AuthStatus;
  me: MeResponse | null;
  session: Session | null;
  user: User | null;
  fromCache: boolean;
} {
  if (typeof window === "undefined" || !window.localStorage) {
    return { status: "loading", me: null, session: null, user: null, fromCache: false };
  }
  try {
    const storageSession = readSupabaseSession();
    if (!storageSession) return { status: "unauthenticated", me: null, session: null, user: null, fromCache: false };

    const cached = readMeCache(storageSession.userId);
    const me = cached ?? buildFallback(
      storageSession.userId,
      storageSession.email,
      storageSession.userMetadata,
    );
    const { session, user } = readSessionAndUserFromStorage();

    return {
      status: "authenticated",
      me,
      session,
      user,
      fromCache: !!cached,
    };
  } catch {
    return { status: "loading", me: null, session: null, user: null, fromCache: false };
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Estado inicial sempre "loading" — servidor e cliente devem renderizar igual para evitar
  // hydration mismatch (server não tem localStorage; cliente teria cache diferente).
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  const profileFetchedRef = useRef(false);

  async function reloadMe() {
    if (user) {
      clearMeCache();
      profileFetchedRef.current = false;
      const data = await fetchMe(user.id).catch(() => null);
      const result = data ?? buildFallback(user.id, user.email ?? "", user.user_metadata ?? {});
      setMe(result);
      writeMeCache(user.id, result);
    }
  }

  // useLayoutEffect: roda antes do paint — evita flash de "Carregando" ao dar F5.
  useLayoutEffect(() => {
    const stored = getStateFromStorage();
    if (stored.status === "authenticated") {
      setSession(stored.session);
      setUser(stored.user);
      setStatus("authenticated");
      setMe(stored.me);

      // Com cache válido: não chamar fetchMe no load — evita request dim_usuarios de 2s+.
      // O cache já tem o role; fetchMe roda apenas quando não temos cache.
      if (!stored.fromCache && stored.user && !profileFetchedRef.current) {
        profileFetchedRef.current = true;
        const userIdToFetch = stored.user.id;
        setTimeout(() => {
          fetchMe(userIdToFetch)
            .then((fresh) => {
              if (fresh) {
                setMe(fresh);
                writeMeCache(userIdToFetch, fresh);
              }
            })
            .catch(() => {});
        }, 0);
      }
    } else if (stored.status === "unauthenticated") {
      setStatus("unauthenticated");
    }

    // 2. getSession() dispara refresh_token; evitar quando já temos sessão no storage.
    // O onAuthStateChange (INITIAL_SESSION) traz a sessão quando o cliente inicializa.
    if (stored.status !== "authenticated") {
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setStatus("authenticated");
          const cached = readMeCache(currentSession.user.id);
          const fallback = buildFallback(
            currentSession.user.id,
            currentSession.user.email ?? "",
            currentSession.user.user_metadata ?? {},
          );
          setMe(cached ?? fallback);
          if (!profileFetchedRef.current) {
            profileFetchedRef.current = true;
            setTimeout(() => {
              fetchMe(currentSession.user.id)
                .then((fresh) => {
                  if (fresh) {
                    setMe(fresh);
                    writeMeCache(currentSession.user.id, fresh);
                  }
                })
                .catch(() => {});
            }, 0);
          }
        } else if (stored.status === "unauthenticated") {
          setStatus("unauthenticated");
        }
      });
    }

    // 3. Listener para mudanças de auth (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          setStatus("authenticated");

          const cached = readMeCache(newSession.user.id);
          const fallback = buildFallback(
            newSession.user.id,
            newSession.user.email ?? "",
            newSession.user.user_metadata ?? {},
          );
          // Sempre definir me imediatamente — nunca deixar null quando autenticado
          setMe(cached ?? fallback);

          if (!profileFetchedRef.current) {
            profileFetchedRef.current = true;
            setTimeout(() => {
              fetchMe(newSession.user.id)
                .then((fresh) => {
                  const result = fresh ?? fallback;
                  setMe(result);
                  writeMeCache(newSession.user.id, result);
                })
                .catch(() => {
                  if (!cached) setMe(fallback);
                });
            }, 0);
          }
        } else {
          if (event !== "INITIAL_SESSION" || stored.status !== "authenticated") {
            profileFetchedRef.current = false;
            clearMeCache();
            setSession(null);
            setUser(null);
            setMe(null);
            setStatus("unauthenticated");
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ status, session, user, me, reloadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
