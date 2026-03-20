/**
 * Converte tbl_scores_calculados_rows.csv em SQL INSERT para o Supabase
 * Uso: npx tsx scripts/csv-to-sql-scores-calculados.ts
 * Saída: supabase/tbl_scores_calculados_insert.sql
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
  const csvPath = join(process.cwd(), "tbl_scores_calculados_rows.csv");
  const outPath = join(process.cwd(), "supabase", "tbl_scores_calculados_insert.sql");

  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const dbCols = ["id", "auditoriaId", "scoreGeral", "totalItens", "totalAplicavel", "totalConforme", "totalNaoConforme", "totalNa", "pontosObtidos", "pontosPossiveis", "ultimaAtualizacao"];
  const sqlCols = dbCols.map((c) => `"${c}"`).join(", ");

  const values: string[] = [];
  for (const row of rows) {
    const vals = dbCols.map((col) => {
      const v = row[col] ?? row[col.replace(/([A-Z])/g, (m: string) => "_" + m.toLowerCase())];
      const s = v != null ? String(v).trim() : "";

      if (col === "id" || col === "auditoriaId") {
        if (!s || s === "NULL" || s === "null") return "NULL";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "NULL";
        return escapeSql(s);
      }
      if (["scoreGeral", "totalItens", "totalAplicavel", "totalConforme", "totalNaoConforme", "totalNa", "pontosObtidos", "pontosPossiveis"].includes(col)) {
        return s && !isNaN(parseFloat(s)) ? s : "0";
      }
      if (col === "ultimaAtualizacao") {
        if (!s || s === "NULL" || s === "null") return "CURRENT_TIMESTAMP";
        return escapeSql(s);
      }
      return escapeSql(s || "");
    });
    values.push(`  (${vals.join(", ")})`);
  }

  const sql = `-- Inserção de tbl_scores_calculados a partir de tbl_scores_calculados_rows.csv
-- Execute no Supabase SQL Editor (após fato_auditorias)

INSERT INTO public.tbl_scores_calculados (${sqlCols})
VALUES
${values.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  "auditoriaId" = EXCLUDED."auditoriaId",
  "scoreGeral" = EXCLUDED."scoreGeral",
  "totalItens" = EXCLUDED."totalItens",
  "totalAplicavel" = EXCLUDED."totalAplicavel",
  "totalConforme" = EXCLUDED."totalConforme",
  "totalNaoConforme" = EXCLUDED."totalNaoConforme",
  "totalNa" = EXCLUDED."totalNa",
  "pontosObtidos" = EXCLUDED."pontosObtidos",
  "pontosPossiveis" = EXCLUDED."pontosPossiveis",
  "ultimaAtualizacao" = EXCLUDED."ultimaAtualizacao";
`;

  writeFileSync(outPath, sql, "utf-8");
  console.log(`✅ SQL gerado: supabase/tbl_scores_calculados_insert.sql (${rows.length} linhas)\n`);
}

main();
