/**
 * Converte tbl_template_aplicabilidade_fases_rows.csv em SQL INSERT para o Supabase
 * Uso: npx tsx scripts/csv-to-sql-aplicabilidade-fases.ts
 * Saída: supabase/tbl_template_aplicabilidade_fases_insert.sql
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
  const csvPath = join(process.cwd(), "tbl_template_aplicabilidade_fases_rows.csv");
  const outPath = join(process.cwd(), "supabase", "tbl_template_aplicabilidade_fases_insert.sql");

  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const dbCols = ["id", "templateItemId", "faseId", "obrigatorio", "createdAt"];
  const sqlCols = dbCols.map((c) => `"${c}"`).join(", ");

  const values: string[] = [];
  for (const row of rows) {
    const vals = dbCols.map((col) => {
      const v = row[col] ?? row[col.replace(/([A-Z])/g, (m: string) => "_" + m.toLowerCase())];
      const s = v != null ? String(v).trim() : "";

      if (col === "obrigatorio") return s === "true" || s === "t" || s === "1" ? "true" : "false";
      if (col === "id" || col === "templateItemId" || col === "faseId") {
        if (!s || s === "NULL" || s === "null") return "NULL";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "NULL";
        return escapeSql(s);
      }
      if (col === "createdAt") {
        if (!s || s === "NULL" || s === "null") return "CURRENT_TIMESTAMP";
        return escapeSql(s);
      }
      return escapeSql(s || "");
    });
    values.push(`  (${vals.join(", ")})`);
  }

  const sql = `-- Inserção de tbl_template_aplicabilidade_fases a partir de tbl_template_aplicabilidade_fases_rows.csv
-- Execute no Supabase SQL Editor (após tbl_checklist_template e dim_fases)

INSERT INTO public.tbl_template_aplicabilidade_fases (${sqlCols})
VALUES
${values.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  "templateItemId" = EXCLUDED."templateItemId",
  "faseId" = EXCLUDED."faseId",
  obrigatorio = EXCLUDED.obrigatorio;
`;

  writeFileSync(outPath, sql, "utf-8");
  console.log(`✅ SQL gerado: supabase/tbl_template_aplicabilidade_fases_insert.sql (${rows.length} linhas)\n`);
}

main();
