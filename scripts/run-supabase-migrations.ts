/**
 * Script para executar todas as migrations Supabase em ordem
 * Uso: npx tsx scripts/run-supabase-migrations.ts
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida. Configure no .env");
    process.exit(1);
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("Nenhuma migration encontrada.");
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log(`\n📦 Aplicando ${files.length} migrations no Supabase...\n`);

    for (const file of files) {
      const sqlPath = join(MIGRATIONS_DIR, file);
      const sql = readFileSync(sqlPath, "utf-8");
      try {
        await client.query(sql);
        console.log(`  ✅ ${file}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists") || msg.includes("duplicate key")) {
          console.log(`  ⏭️  ${file} (já aplicado)`);
        } else {
          console.error(`  ❌ ${file}:`, msg);
          throw err;
        }
      }
    }

    console.log(`\n✅ Todas as migrations Supabase foram aplicadas.\n`);
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
