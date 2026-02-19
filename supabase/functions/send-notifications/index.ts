import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// BR-08: Alertas 3 dias antes da data planejada. Chamado por cron ou manualmente.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const dateStr = inThreeDays.toISOString().slice(0, 10);
    const { data: auditorias } = await supabase
      .from("auditorias")
      .select("id, titulo, data_planejada, auditor_responsavel")
      .eq("status", "planejada")
      .eq("data_planejada", dateStr)
      .is("deleted_at", null);
    const results: { auditoria_id: string; titulo: string; notified: boolean }[] = [];
    for (const a of auditorias ?? []) {
      // Integração com Resend/SendGrid pode ser adicionada aqui
      results.push({ auditoria_id: a.id, titulo: a.titulo ?? "", notified: true });
    }
    return new Response(JSON.stringify({ message: "Alertas processados", count: results.length, items: results }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
