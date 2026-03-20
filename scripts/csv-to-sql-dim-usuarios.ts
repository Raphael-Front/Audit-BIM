/**
 * Converte dim_usuarios_rows.csv em SQL INSERT para o Supabase
 * Uso: npx tsx scripts/csv-to-sql-dim-usuarios.ts
 * Saída: supabase/dim_usuarios_insert.sql
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";

function escapeSql(val: string | null | undefined): string {
  if (val === null || val === undefined || val === "" || val.toLowerCase() === "null") return "NULL";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function main() {
  const csvPath = join(process.cwd(), "dim_usuarios_rows.csv");
  const outPath = join(process.cwd(), "supabase", "dim_usuarios_insert.sql");

  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const dbCols = ["id", "email", "nomeCompleto", "senhaHash", "perfil", "ativo", "ultimoAcesso", "createdAt", "updatedAt", "auth_user_id", "avatar_url"];
  const sqlCols = dbCols.map((c) => `"${c}"`).join(", ");

  const values: string[] = [];
  for (const row of rows) {
    const vals = dbCols.map((col) => {
      const v = row[col] ?? row[col.replace(/([A-Z])/g, (m: string) => "_" + m.toLowerCase())];
      if (col === "ativo") return v === "true" || v === "t" || v === "1" ? "true" : "false";
      if (col === "ultimoAcesso" || col === "createdAt" || col === "updatedAt" || col === "auth_user_id" || col === "avatar_url" || col === "senhaHash") {
        if (!v || v === "NULL" || v === "null" || String(v).trim() === "") return "NULL";
        return escapeSql(String(v).trim());
      }
      if (!v || v === "NULL" || v === "null" || String(v).trim() === "") return "NULL";
      return escapeSql(String(v).trim());
    });
    values.push(`  (${vals.join(", ")})`);
  }

  const sql = `-- Inserção de dim_usuarios a partir de dim_usuarios_rows.csv
-- Execute no Supabase SQL Editor

INSERT INTO public.dim_usuarios (${sqlCols})
VALUES
${values.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  "nomeCompleto" = EXCLUDED."nomeCompleto",
  "senhaHash" = EXCLUDED."senhaHash",
  perfil = EXCLUDED.perfil,
  ativo = EXCLUDED.ativo,
  "ultimoAcesso" = EXCLUDED."ultimoAcesso",
  "updatedAt" = EXCLUDED."updatedAt",
  auth_user_id = EXCLUDED.auth_user_id,
  avatar_url = EXCLUDED.avatar_url;
`;

  writeFileSync(outPath, sql, "utf-8");
  console.log(`✅ SQL gerado: supabase/dim_usuarios_insert.sql (${rows.length} linhas)\n`);
}

main();
