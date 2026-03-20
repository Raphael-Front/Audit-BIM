import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios para Supabase.");
}

const REQUEST_TIMEOUT_MS = 10_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const signal = init?.signal
    ? anySignal([init.signal, controller.signal])
    : controller.signal;

  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer));

  function anySignal(signals: AbortSignal[]): AbortSignal {
    const ctrl = new AbortController();
    for (const sig of signals) {
      if (sig.aborted) { ctrl.abort(sig.reason); break; }
      sig.addEventListener("abort", () => ctrl.abort(sig.reason), { once: true });
    }
    return ctrl.signal;
  }
}

let instance: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  if (!url || !key) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env");
  }
  if (!instance) {
    instance = createClient(url, key, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        fetch: fetchWithTimeout,
      },
    });
  }
  return instance;
}
