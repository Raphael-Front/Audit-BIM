import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const VALID_TRANSITIONS: Record<string, string[]> = {
  planejada: ["em_andamento", "cancelada"],
  em_andamento: ["aguardando_apontamentos", "cancelada"],
  aguardando_apontamentos: ["concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const body = await req.json() as { auditoria_id: string; novo_status: string; justificativa?: string };
    const { auditoria_id, novo_status, justificativa } = body;
    if (!auditoria_id || !novo_status) {
      return new Response(JSON.stringify({ error: "auditoria_id e novo_status obrigatórios" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: audit, error: fetchErr } = await supabase.from("auditorias").select("id, status").eq("id", auditoria_id).single();
    if (fetchErr || !audit) return new Response(JSON.stringify({ error: "Auditoria não encontrada" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    const allowed = VALID_TRANSITIONS[audit.status as keyof typeof VALID_TRANSITIONS];
    if (!allowed?.includes(novo_status)) {
      return new Response(JSON.stringify({ error: `Transição de ${audit.status} para ${novo_status} não permitida` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (novo_status === "cancelada" && !justificativa?.trim()) {
      return new Response(JSON.stringify({ error: "Justificativa obrigatória para cancelamento" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (novo_status === "concluida") {
      const { data: allNcs } = await supabase.from("auditoria_itens").select("id, construflow_id").eq("auditoria_id", auditoria_id).eq("status_avaliacao", "nao_conforme");
      const missing = (allNcs ?? []).filter((r) => !(r.construflow_id && String(r.construflow_id).trim()));
      if (missing.length > 0) return new Response(JSON.stringify({ error: "Todos os itens NC devem ter construflow_id antes de concluir" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const update: Record<string, unknown> = { status: novo_status };
    if (novo_status === "concluida") update.data_conclusao = new Date().toISOString();
    if (novo_status === "cancelada") update.observacoes_gerais = (audit as { observacoes_gerais?: string }).observacoes_gerais ? `${(audit as { observacoes_gerais: string }).observacoes_gerais}\nCancelamento: ${justificativa}` : `Cancelamento: ${justificativa}`;
    const { data: updated, error } = await supabase.from("auditorias").update(update).eq("id", auditoria_id).select().single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(updated), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
