/**
 * Script para executar a migration da categoria "Outros"
 * Uso: npx tsx scripts/run-outros-category-migration.ts
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

  const migrations = ["011_outros_category.sql", "012_get_or_create_outros_category.sql"];
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    for (const file of migrations) {
      const sqlPath = join(process.cwd(), "supabase", "migrations", file);
      const sql = readFileSync(sqlPath, "utf-8");
      await client.query(sql);
      console.log(`✅ Migration ${file} executada com sucesso.`);
    }
  } catch (err) {
    console.error("❌ Erro ao executar migration:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
