/**
 * Converte fato_auditorias_rows.csv em SQL INSERT para o Supabase
 * Uso: npx tsx scripts/csv-to-sql-fato-auditorias.ts [--chunks=N]
 * Saída: supabase/fato_auditorias_insert.sql (ou fato_auditorias_insert_01.sql, _02.sql... com --chunks)
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

  const csvPath = join(process.cwd(), "fato_auditorias_rows.csv");
  const outDir = join(process.cwd(), "supabase");

  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const dbCols = [
    "id", "codigoAuditoria", "obraId", "disciplinaId", "faseId", "revisao", "titulo",
    "auditorResponsavelId", "status", "dataInicio", "dataFimPrevista", "dataFinalizacaoReal",
    "dataEntradaStandby", "dataConclusao", "tempoTotalPausa", "motivoCancelamento",
    "canceladoPorId", "canceladoEm", "observacoesGerais", "createdAt", "updatedAt"
  ];
  const sqlCols = dbCols.map((c) => `"${c}"`).join(", ");

  const values: string[] = [];
  for (const row of rows) {
    const vals = dbCols.map((col) => {
      const v = row[col] ?? row[col.replace(/([A-Z])/g, (m: string) => "_" + m.toLowerCase())];
      const s = v != null ? String(v).trim() : "";

      if (col === "canceladoPorId") return "NULL";
      if (col === "auditorResponsavelId") return "(SELECT id FROM public.dim_usuarios LIMIT 1)";
      if (col === "revisao") return s && !isNaN(Number(s)) ? s : "1";
      const nullable = ["titulo", "dataFimPrevista", "dataFinalizacaoReal", "dataEntradaStandby", "dataConclusao", "tempoTotalPausa", "motivoCancelamento", "canceladoEm", "observacoesGerais"];
      if (nullable.includes(col)) {
        if (!s || s === "NULL" || s === "null") return "NULL";
        if (col === "canceladoEm" || col.includes("data")) return escapeSql(s);
        return escapeSql(s);
      }
      const uuidCols = ["id", "obraId", "disciplinaId", "faseId"];
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
  "codigoAuditoria" = EXCLUDED."codigoAuditoria",
  "obraId" = EXCLUDED."obraId",
  "disciplinaId" = EXCLUDED."disciplinaId",
  "faseId" = EXCLUDED."faseId",
  revisao = EXCLUDED.revisao,
  titulo = EXCLUDED.titulo,
  "auditorResponsavelId" = (SELECT id FROM public.dim_usuarios LIMIT 1),
  status = EXCLUDED.status,
  "dataInicio" = EXCLUDED."dataInicio",
  "dataFimPrevista" = EXCLUDED."dataFimPrevista",
  "dataFinalizacaoReal" = EXCLUDED."dataFinalizacaoReal",
  "dataEntradaStandby" = EXCLUDED."dataEntradaStandby",
  "dataConclusao" = EXCLUDED."dataConclusao",
  "tempoTotalPausa" = EXCLUDED."tempoTotalPausa",
  "motivoCancelamento" = EXCLUDED."motivoCancelamento",
  "canceladoPorId" = NULL,
  "canceladoEm" = EXCLUDED."canceladoEm",
  "observacoesGerais" = EXCLUDED."observacoesGerais",
  "updatedAt" = EXCLUDED."updatedAt"`;

  const header = `-- Inserção de fato_auditorias a partir de fato_auditorias_rows.csv
-- Execute no Supabase SQL Editor (após dim_obras, dim_disciplinas, dim_fases, dim_usuarios)

-- Remove FK canceladoPorId (pode referenciar usuários não migrados)
ALTER TABLE public.fato_auditorias DROP CONSTRAINT IF EXISTS fato_auditorias_canceladoPorId_fkey;

`;

  if (chunkSize > 0) {
    let written = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const part = Math.floor(i / chunkSize) + 1;
      const chunkHeader = part === 1 ? header : `-- fato_auditorias - parte ${part}\n\n`;
      const sql = chunkHeader + `INSERT INTO public.fato_auditorias (${sqlCols})
VALUES
${chunk.join(",\n")}
${upsertClause};
`;
      const outPath = join(outDir, `fato_auditorias_insert_${String(part).padStart(2, "0")}.sql`);
      writeFileSync(outPath, sql, "utf-8");
      written++;
    }
    console.log(`✅ SQL gerado em ${written} arquivos: supabase/fato_auditorias_insert_01.sql ... (${rows.length} linhas, ${chunkSize} por arquivo)\n`);
  } else {
    const sql = header + `INSERT INTO public.fato_auditorias (${sqlCols})
VALUES
${values.join(",\n")}
${upsertClause};
`;
    writeFileSync(join(outDir, "fato_auditorias_insert.sql"), sql, "utf-8");
    console.log(`✅ SQL gerado: supabase/fato_auditorias_insert.sql (${rows.length} linhas)\n`);
  }
}

main();
