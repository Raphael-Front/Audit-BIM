import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    const contentType = req.headers.get("Content-Type") ?? "";
    const mime = contentType.split(";")[0].trim();
    if (!ALLOWED.includes(mime)) return new Response(JSON.stringify({ error: "Formato não permitido. Use JPG, PNG ou PDF." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const url = new URL(req.url);
    const auditoriaId = url.searchParams.get("auditoria_id");
    const itemId = url.searchParams.get("item_id");
    const obraId = url.searchParams.get("obra_id");
    if (!obraId || !auditoriaId || !itemId) return new Response(JSON.stringify({ error: "obra_id, auditoria_id e item_id obrigatórios na query" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "pdf";
    const name = `${obraId}/auditorias/${auditoriaId}/evidencias/${itemId}-${Date.now()}.${ext}`;
    const buf = await req.arrayBuffer();
    const { data: upload, error: uploadErr } = await supabase.storage.from("audit-evidencias").upload(name, buf, { contentType: mime, upsert: false });
    if (uploadErr) return new Response(JSON.stringify({ error: uploadErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const item = await supabase.from("auditoria_itens").select("evidencias").eq("id", itemId).single();
    const urls: string[] = Array.isArray(item?.data?.evidencias) ? (item.data.evidencias as string[]) : [];
    urls.push(upload.path);
    await supabase.from("auditoria_itens").update({ evidencias: urls, updated_at: new Date().toISOString() }).eq("id", itemId);
    const { data: signed } = await supabase.storage.from("audit-evidencias").createSignedUrl(upload.path, 3600);
    return new Response(JSON.stringify({ path: upload.path, signedUrl: signed?.signedUrl }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
