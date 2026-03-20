/**
 * Stub: Supabase server client for Next.js SSR.
 * Will be replaced with createServerClient (@supabase/ssr) in supabase-server-client todo.
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
