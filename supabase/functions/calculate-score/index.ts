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
    const url = new URL(req.url);
    const auditoriaId = url.searchParams.get("auditoria_id");
    if (!auditoriaId) return new Response(JSON.stringify({ error: "auditoria_id obrigatório" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const { data: score, error } = await supabase.rpc("calculate_audit_score", { p_auditoria_id: auditoriaId });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ score }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
