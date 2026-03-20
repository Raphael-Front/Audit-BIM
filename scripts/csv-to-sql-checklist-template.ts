/**
 * Converte tbl_checklist_template_rows.csv em SQL INSERT para o Supabase
 * Uso: npx tsx scripts/csv-to-sql-checklist-template.ts
 * Saída: supabase/tbl_checklist_template_insert.sql
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";

function escapeSql(val: string | null | undefined): string {
  if (val === null || val === undefined || val === "" || String(val).toLowerCase() === "null") return "NULL";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function main() {
  const csvPath = join(process.cwd(), "tbl_checklist_template_rows.csv");
  const outPath = join(process.cwd(), "supabase", "tbl_checklist_template_insert.sql");

  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const dbCols = ["id", "versao", "disciplinaId", "categoriaId", "itemVerificacao", "peso", "pontosMaximo", "origem", "auditoriaOrigemId", "ativo", "ordemExibicao", "createdAt", "updatedAt", "inativadoEm", "inativadoPorId"];
  const sqlCols = dbCols.map((c) => `"${c}"`).join(", ");

  const nullableCols = ["auditoriaOrigemId", "inativadoEm", "inativadoPorId"];
  const timestampCols = ["createdAt", "updatedAt", "inativadoEm"];
  const uuidCols = ["id", "disciplinaId", "categoriaId", "auditoriaOrigemId", "inativadoPorId"];

  const values: string[] = [];
  for (const row of rows) {
    const vals = dbCols.map((col) => {
      const v = row[col] ?? row[col.replace(/([A-Z])/g, (m: string) => "_" + m.toLowerCase())];
      const s = v != null ? String(v).trim() : "";

      if (col === "ativo") return s === "true" || s === "t" || s === "1" ? "true" : "false";
      if (col === "versao" || col === "peso" || col === "ordemExibicao") return s && !isNaN(Number(s)) ? s : "1";
      if (col === "pontosMaximo") return s && !isNaN(parseFloat(s)) ? s : "0";
      if (col === "inativadoPorId") return "NULL";
      if (nullableCols.includes(col) || timestampCols.includes(col) || uuidCols.includes(col)) {
        if (!s || s === "NULL" || s === "null") return "NULL";
        if (uuidCols.includes(col) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "NULL";
        return escapeSql(s);
      }
      return escapeSql(s || "");
    });
    values.push(`  (${vals.join(", ")})`);
  }

  const sql = `-- Inserção de tbl_checklist_template a partir de tbl_checklist_template_rows.csv
-- Execute no Supabase SQL Editor (após dim_disciplinas, dim_categorias, dim_usuarios)

-- Remove FK para permitir importar (inativadoPorId pode referenciar usuários não migrados)
ALTER TABLE public.tbl_checklist_template DROP CONSTRAINT IF EXISTS tbl_checklist_template_inativadoPorId_fkey;

INSERT INTO public.tbl_checklist_template (${sqlCols})
VALUES
${values.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  versao = EXCLUDED.versao,
  "disciplinaId" = EXCLUDED."disciplinaId",
  "categoriaId" = EXCLUDED."categoriaId",
  "itemVerificacao" = EXCLUDED."itemVerificacao",
  peso = EXCLUDED.peso,
  "pontosMaximo" = EXCLUDED."pontosMaximo",
  origem = EXCLUDED.origem,
  "auditoriaOrigemId" = EXCLUDED."auditoriaOrigemId",
  ativo = EXCLUDED.ativo,
  "ordemExibicao" = EXCLUDED."ordemExibicao",
  "updatedAt" = EXCLUDED."updatedAt",
  "inativadoEm" = EXCLUDED."inativadoEm",
  "inativadoPorId" = NULL;
`;

  writeFileSync(outPath, sql, "utf-8");
  console.log(`✅ SQL gerado: supabase/tbl_checklist_template_insert.sql (${rows.length} linhas)\n`);
}

main();
