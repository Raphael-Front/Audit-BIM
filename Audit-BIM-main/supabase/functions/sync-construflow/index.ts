import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Integração Construflow: stub para envio/recebimento de NCs quando API estiver disponível
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; construflow_id?: string; nc_data?: unknown };
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (body.action === "sync_status" && body.construflow_id) {
      // Quando a API Construflow estiver disponível: GET status do apontamento e atualizar auditoria_itens
      return new Response(JSON.stringify({ message: "Sync não configurado", construflow_id: body.construflow_id }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ message: "Construflow integration stub" }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
