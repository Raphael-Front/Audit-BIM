/**
 * Valida integridade dos dados importados no Supabase.
 * Verifica FKs (obras → auditorias → itens), consistência de status e gera relatório.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { join } from "path";

const LOG_DIR = ".";

type ValidationIssue = { table: string; id?: string; message: string; severity: "error" | "warning" };
const issues: ValidationIssue[] = [];

function add(table: string, message: string, id?: string, severity: "error" | "warning" = "error") {
  issues.push({ table, id, message, severity });
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  return createClient(url, key);
}

async function validateObras(supabase: ReturnType<typeof createClient>) {
  const { data: obras, error } = await supabase.from("obras").select("id, nome, codigo, status").is("deleted_at", null);
  if (error) {
    add("obras", `Falha ao listar: ${error.message}`);
    return;
  }
  for (const o of obras ?? []) {
    if (!o.nome?.trim()) add("obras", "Nome vazio", o.id);
    if (o.codigo && typeof o.codigo !== "string") add("obras", "Código inválido", o.id);
  }
}

async function validateTemplates(supabase: ReturnType<typeof createClient>) {
  const { data: templates, error } = await supabase.from("templates").select("id, nome, disciplina, ativo");
  if (error) {
    add("templates", `Falha ao listar: ${error.message}`);
    return;
  }
  for (const t of templates ?? []) {
    if (!t.nome?.trim()) add("templates", "Nome vazio", t.id);
  }
}

async function validateTemplateItens(supabase: ReturnType<typeof createClient>) {
  const { data: items, error } = await supabase.from("template_itens").select("id, template_id, descricao");
  if (error) {
    add("template_itens", `Falha ao listar: ${error.message}`);
    return;
  }
  const { data: templates } = await supabase.from("templates").select("id");
  const templateIds = new Set((templates ?? []).map((t) => t.id));
  for (const it of items ?? []) {
    if (!it.descricao?.trim()) add("template_itens", "Descrição vazia", it.id);
    if (!templateIds.has(it.template_id)) add("template_itens", "template_id não existe", it.id);
  }
}

async function validateAuditorias(supabase: ReturnType<typeof createClient>) {
  const { data: auditorias, error } = await supabase
    .from("auditorias")
    .select("id, obra_id, template_id, titulo, status, data_planejada, data_inicio, data_conclusao")
    .is("deleted_at", null);
  if (error) {
    add("auditorias", `Falha ao listar: ${error.message}`);
    return;
  }
  const { data: obras } = await supabase.from("obras").select("id").is("deleted_at", null);
  const { data: templates } = await supabase.from("templates").select("id");
  const obraIds = new Set((obras ?? []).map((o) => o.id));
  const templateIds = new Set((templates ?? []).map((t) => t.id));
  for (const a of auditorias ?? []) {
    if (!obraIds.has(a.obra_id)) add("auditorias", "obra_id não existe", a.id);
    if (!templateIds.has(a.template_id)) add("auditorias", "template_id não existe", a.id);
    if (!a.titulo?.trim()) add("auditorias", "Título vazio", a.id, "warning");
    if (a.status === "concluida" && !a.data_conclusao) add("auditorias", "Concluída sem data_conclusao", a.id, "warning");
  }
}

async function validateAuditoriaItens(supabase: ReturnType<typeof createClient>) {
  const { data: items, error } = await supabase
    .from("auditoria_itens")
    .select("id, auditoria_id, descricao, status_avaliacao, construflow_id");
  if (error) {
    add("auditoria_itens", `Falha ao listar: ${error.message}`);
    return;
  }
  const { data: auditorias } = await supabase.from("auditorias").select("id").is("deleted_at", null);
  const auditIds = new Set((auditorias ?? []).map((a) => a.id));
  for (const it of items ?? []) {
    if (!auditIds.has(it.auditoria_id)) add("auditoria_itens", "auditoria_id não existe", it.id);
    if (!it.descricao?.trim()) add("auditoria_itens", "Descrição vazia", it.id);
    if (
      it.status_avaliacao === "nao_conforme" &&
      (!it.construflow_id || String(it.construflow_id).trim() === "")
    ) {
      const { data: audit } = await supabase.from("auditorias").select("status").eq("id", it.auditoria_id).single();
      if (audit?.status === "concluida") add("auditoria_itens", "NC sem construflow_id em auditoria concluída", it.id);
    }
  }
}

function generateReport(): string {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  let out = "# Relatório de Validação\n\n";
  out += `Data: ${new Date().toISOString()}\n\n`;
  out += `## Resumo\n`;
  out += `- Erros: ${errors.length}\n`;
  out += `- Avisos: ${warnings.length}\n\n`;
  if (errors.length) {
    out += `## Erros\n`;
    errors.forEach((i) => (out += `- [${i.table}] ${i.id ?? ""} ${i.message}\n"));
    out += "\n";
  }
  if (warnings.length) {
    out += `## Avisos\n`;
    warnings.forEach((i) => (out += `- [${i.table}] ${i.id ?? ""} ${i.message}\n`));
  }
  return out;
}

async function main() {
  const supabase = getSupabaseClient();
  await validateObras(supabase);
  await validateTemplates(supabase);
  await validateTemplateItens(supabase);
  await validateAuditorias(supabase);
  await validateAuditoriaItens(supabase);

  const report = generateReport();
  console.log(report);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = join(LOG_DIR, `validation-report-${ts}.md`);
  writeFileSync(filename, report, "utf-8");
  console.log(`Relatório gravado em ${filename}`);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
