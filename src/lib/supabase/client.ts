import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Placeholders para permitir o build (ex: Vercel) quando as variáveis ainda não foram configuradas.
// Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no Vercel (Settings → Environment Variables).
const effectiveUrl = url || "https://placeholder.supabase.co";
const effectiveKey =
  key ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxOTU3MzQ1NjAwfQ.placeholder";

let instance: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  if (!instance) {
    instance = createClient(effectiveUrl, effectiveKey, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return instance;
}
