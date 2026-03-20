/**
 * Converte fato_auditoria_itens_rows.csv em SQL INSERT para o Supabase
 * Uso: npx tsx scripts/csv-to-sql-fato-auditoria-itens.ts [--chunks=N]
 * Saída: supabase/fato_auditoria_itens_insert.sql (ou fato_auditoria_itens_insert_01.sql... com --chunks)
 * --chunks=N: divide em arquivos menores para rodar no SQL Editor sem estourar memória
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
  const chunksArg = process.argv.find((a) => a.startsWith("--chunks="));
  const chunkSize = chunksArg ? Math.max(1, parseInt(chunksArg.split("=")[1] || "50", 10)) : 0;

  const csvPath = join(process.cwd(), "fato_auditoria_itens_rows.csv");
  const outDir = join(process.cwd(), "supabase");

  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const dbCols = [
    "id", "auditoriaId", "templateItemId", "categoriaId", "disciplinaId", "itemVerificacaoSnapshot",
    "pesoSnapshot", "pontosMaximoSnapshot", "tipoItem", "status", "evidenciaObservacao", "codigoConstruflow",
    "proximaRevisao", "pontosObtidos", "avaliadoEm", "avaliadoPorId", "ordemExibicao", "createdAt", "updatedAt"
  ];
  const sqlCols = dbCols.map((c) => `"${c}"`).join(", ");

  const values: string[] = [];
  for (const row of rows) {
    const vals = dbCols.map((col) => {
      const v = row[col] ?? row[col.replace(/([A-Z])/g, (m: string) => "_" + m.toLowerCase())];
      const s = v != null ? String(v).trim() : "";

      if (col === "avaliadoPorId") return "NULL";
      if (col === "pesoSnapshot" || col === "ordemExibicao") return s && !isNaN(Number(s)) ? s : "0";
      if (col === "pontosMaximoSnapshot" || col === "pontosObtidos") return s && !isNaN(parseFloat(s)) ? s : "0";
      const nullable = ["templateItemId", "evidenciaObservacao", "codigoConstruflow", "proximaRevisao", "avaliadoEm"];
      if (nullable.includes(col)) {
        if (!s || s === "NULL" || s === "null") return "NULL";
        if (col === "proximaRevisao" || col === "avaliadoEm") return escapeSql(s);
        return escapeSql(s);
      }
      const uuidCols = ["id", "auditoriaId", "templateItemId", "categoriaId", "disciplinaId"];
      if (uuidCols.includes(col)) {
        if (!s || s === "NULL" || s === "null") return "NULL";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "NULL";
        return escapeSql(s);
      }
      if (col === "createdAt" || col === "updatedAt") {
        if (!s || s === "NULL" || s === "null") return "CURRENT_TIMESTAMP";
        return escapeSql(s);
      }
      return escapeSql(s || "");
    });
    values.push(`  (${vals.join(", ")})`);
  }

  const upsertClause = `ON CONFLICT (id) DO UPDATE SET
  "auditoriaId" = EXCLUDED."auditoriaId",
  "templateItemId" = EXCLUDED."templateItemId",
  "categoriaId" = EXCLUDED."categoriaId",
  "disciplinaId" = EXCLUDED."disciplinaId",
  "itemVerificacaoSnapshot" = EXCLUDED."itemVerificacaoSnapshot",
  "pesoSnapshot" = EXCLUDED."pesoSnapshot",
  "pontosMaximoSnapshot" = EXCLUDED."pontosMaximoSnapshot",
  "tipoItem" = EXCLUDED."tipoItem",
  status = EXCLUDED.status,
  "evidenciaObservacao" = EXCLUDED."evidenciaObservacao",
  "codigoConstruflow" = EXCLUDED."codigoConstruflow",
  "proximaRevisao" = EXCLUDED."proximaRevisao",
  "pontosObtidos" = EXCLUDED."pontosObtidos",
  "avaliadoEm" = EXCLUDED."avaliadoEm",
  "avaliadoPorId" = NULL,
  "ordemExibicao" = EXCLUDED."ordemExibicao",
  "updatedAt" = EXCLUDED."updatedAt"`;

  const header = `-- Inserção de fato_auditoria_itens a partir de fato_auditoria_itens_rows.csv
-- Execute no Supabase SQL Editor (após fato_auditorias, dim_categorias, dim_disciplinas, tbl_checklist_template)

-- Remove FK avaliadoPorId (pode referenciar usuários não migrados)
ALTER TABLE public.fato_auditoria_itens DROP CONSTRAINT IF EXISTS fato_auditoria_itens_avaliadoPorId_fkey;

`;

  if (chunkSize > 0) {
    let written = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const part = Math.floor(i / chunkSize) + 1;
      const chunkHeader = part === 1 ? header : `-- fato_auditoria_itens - parte ${part}\n\n`;
      const sql = chunkHeader + `INSERT INTO public.fato_auditoria_itens (${sqlCols})
VALUES
${chunk.join(",\n")}
${upsertClause};
`;
      const outPath = join(outDir, `fato_auditoria_itens_insert_${String(part).padStart(2, "0")}.sql`);
      writeFileSync(outPath, sql, "utf-8");
      written++;
    }
    console.log(`✅ SQL gerado em ${written} arquivos: supabase/fato_auditoria_itens_insert_01.sql ... (${rows.length} linhas, ${chunkSize} por arquivo)\n`);
  } else {
    const sql = header + `INSERT INTO public.fato_auditoria_itens (${sqlCols})
VALUES
${values.join(",\n")}
${upsertClause};
`;
    writeFileSync(join(outDir, "fato_auditoria_itens_insert.sql"), sql, "utf-8");
    console.log(`✅ SQL gerado: supabase/fato_auditoria_itens_insert.sql (${rows.length} linhas)\n`);
  }
}

main();
