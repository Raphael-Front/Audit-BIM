import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const body = await req.json() as { obra_id: string; template_id: string; titulo?: string; data_planejada?: string; auditor_responsavel?: string };
    const { obra_id, template_id, titulo, data_planejada, auditor_responsavel } = body;
    if (!obra_id || !template_id) {
      return new Response(JSON.stringify({ error: "obra_id e template_id obrigatórios" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: auditId, error } = await supabase.rpc("create_audit_from_template", {
      p_obra_id: obra_id,
      p_template_id: template_id,
      p_titulo: titulo ?? null,
      p_data_planejada: data_planejada ?? null,
      p_auditor_responsavel: auditor_responsavel ?? user.id,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const { data: audit } = await supabase.from("auditorias").select("*").eq("id", auditId).single();
    return new Response(JSON.stringify(audit), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
