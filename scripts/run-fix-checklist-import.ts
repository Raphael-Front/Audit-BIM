/**
 * Remove FK de inativadoPorId em tbl_checklist_template para permitir importar CSV
 * Uso: npx tsx scripts/run-fix-checklist-import.ts
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
  const sqlPath = join(process.cwd(), "supabase", "fix-checklist-import.sql");
  const sql = readFileSync(sqlPath, "utf-8");
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(sql);
    console.log("✅ FK inativadoPorId removida. Execute o INSERT de tbl_checklist_template novamente.\n");
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
