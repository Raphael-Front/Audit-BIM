/**
 * Remove FK de auth_user_id em dim_usuarios para permitir importar CSV
 * Uso: npx tsx scripts/run-fix-dim-usuarios-import.ts
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

  const sqlPath = join(process.cwd(), "supabase", "fix-dim_usuarios-import.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log("🔧 Removendo FK auth_user_id para permitir importação...\n");
    await client.query(sql);
    console.log("✅ Concluído. Agora é possível importar dim_usuarios via CSV.\n");
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
