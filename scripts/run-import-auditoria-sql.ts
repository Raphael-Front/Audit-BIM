/**
 * Importa dados de auditoria diretamente no banco via conexão (sem usar SQL Editor).
 * Evita o limite de memória do Supabase SQL Editor.
 *
 * Uso: npx tsx scripts/run-import-auditoria-sql.ts
 *      npm run db:import-auditoria-sql
 *
 * Requer: .env com DATABASE_URL
 * Arquivos: supabase/fato_auditorias_insert.sql e supabase/fato_auditoria_itens_insert.sql
 * Ou versões em chunks: fato_auditorias_insert_01.sql, fato_auditoria_itens_insert_01.sql, etc.
 */
import "dotenv/config";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import pg from "pg";

function findSqlFiles(dir: string, base: string): string[] {
  const single = join(dir, `${base}.sql`);
  if (existsSync(single)) return [single];

  const chunks = readdirSync(dir)
    .filter((f) => f.startsWith(base + "_") && f.endsWith(".sql"))
    .sort()
    .map((f) => join(dir, f));
  return chunks;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida. Configure no .env");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  const supabaseDir = join(process.cwd(), "supabase");

  const bases = ["fato_auditorias_insert", "fato_auditoria_itens_insert"] as const;

  try {
    await client.connect();
    console.log("✅ Conectado ao banco.\n");

    for (const base of bases) {
      const name = base.replace("_insert", "");
      const files = findSqlFiles(supabaseDir, base);
      if (files.length === 0) {
        console.log(`⏭️  ${name}: nenhum arquivo encontrado (${base}.sql ou ${base}_01.sql...), pulando.`);
        continue;
      }

      console.log(`📥 Executando ${name} (${files.length} arquivo(s))...`);
      for (const fullPath of files) {
        const sql = readFileSync(fullPath, "utf-8");
        if (!sql.trim()) continue;
        await client.query(sql);
      }
      console.log(`✅ ${name} importado.\n`);
    }

    console.log("✅ Importação concluída.");
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
