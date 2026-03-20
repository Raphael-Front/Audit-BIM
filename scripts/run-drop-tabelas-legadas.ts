/**
 * Remove tabelas legadas do banco, mantendo apenas as do schema principal
 * Uso: npx tsx scripts/run-drop-tabelas-legadas.ts
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

  const sqlPath = join(process.cwd(), "supabase", "drop-tabelas-legadas.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log("🗑️  Removendo tabelas legadas...\n");
    await client.query(sql);
    console.log("✅ Tabelas legadas removidas.\n");
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
