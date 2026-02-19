import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios para Supabase.");
}

export function createSupabaseClient() {
  if (!url || !key) {
    throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
  }
  return createClient(url, key);
}
