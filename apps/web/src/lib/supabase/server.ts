/**
 * Stub: Supabase server client not used in local/API mode.
 * Auth and data go through the NestJS API (lib/api.ts).
 * Keep for future Supabase migration.
 */
export async function createClient() {
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      exchangeCodeForSession: () => Promise.resolve({ data: null, error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null })), order: () => Promise.resolve({ data: [], error: null }), is: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) })),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
  } as unknown as Awaited<ReturnType<typeof import("@supabase/supabase-js").createClient>>;
}
