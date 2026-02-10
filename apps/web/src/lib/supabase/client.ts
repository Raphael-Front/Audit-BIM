/**
 * Stub: Supabase client not used in local/API mode.
 * Auth and data go through the NestJS API (lib/api.ts).
 * Keep for future Supabase migration.
 */
export function createClient() {
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: "Use API login" } }),
      signOut: () => Promise.resolve({ error: null }),
      exchangeCodeForSession: () => Promise.resolve({ data: null, error: { message: "Use API login" } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null })), order: () => Promise.resolve({ data: [], error: null }) })),
      insert: () => Promise.resolve({ data: null, error: { message: "Use API" } }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), removeChannel: () => {} }),
  } as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;
}
