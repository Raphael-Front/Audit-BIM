/**
 * Executa o schema apenas com as tabelas principais (para importação de CSV)
 * Uso: npx tsx scripts/run-schema-tabelas.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida. Configure no .env");
    process.exit(1);
  }

  const sqlPath = join(process.cwd(), "supabase", "schema-so-tabelas-principais.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log("📦 Criando tabelas no banco...\n");
    await client.query(sql);
    console.log("✅ Tabelas criadas com sucesso. Pronto para importar CSV.\n");
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
