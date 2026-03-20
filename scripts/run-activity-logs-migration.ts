/**
 * Script para executar a migration da tabela tbl_activity_logs
 * Uso: npx tsx scripts/run-activity-logs-migration.ts
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

  const sqlPath = join(process.cwd(), "supabase", "migrations", "010_activity_logs.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(sql);
    console.log("✅ Migration 010_activity_logs executada com sucesso.");
  } catch (err) {
    console.error("❌ Erro ao executar migration:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
