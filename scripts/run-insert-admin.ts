/**
 * Insere admin@bim.local em dim_usuarios via conexão direta.
 * Uso: npx tsx scripts/run-insert-admin.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL não definida no .env");
    process.exit(1);
  }
  const sqlPath = join(process.cwd(), "supabase", "insert-admin-user.sql");
  const sql = readFileSync(sqlPath, "utf-8");
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(sql);
    console.log("✅ admin@bim.local inserido em dim_usuarios.");
  } catch (e: unknown) {
    console.error("❌ Erro:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
