/**
 * Analisa itens de verificação e categorias para encontrar duplicatas.
 * Saída: lista o que seria removido (mantendo o mais antigo de cada grupo).
 * Requer: DATABASE_URL no .env
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getPrismaClient } from "../packages/db/src/index.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "..");
const rootEnv = join(rootDir, ".env");
if (existsSync(rootEnv)) loadEnv({ path: rootEnv });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL não definida no .env");
    process.exit(1);
  }

  const prisma = getPrismaClient();

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  ANÁLISE DE DUPLICATAS — Itens de verificação e categorias");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Categorias duplicadas
  const categorias = await prisma.$queryRaw<
    { nome_norm: string; qtd: bigint; ids: string[] }[]
  >`
    SELECT
      LOWER(TRIM(nome)) AS nome_norm,
      count(*)::int AS qtd,
      array_agg(id::text ORDER BY "createdAt", id) AS ids
    FROM dim_categorias
    GROUP BY LOWER(TRIM(nome))
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `;

  if (categorias.length > 0) {
    console.log("📁 CATEGORIAS DUPLICADAS:\n");
    for (const c of categorias) {
      const qtd = Number(c.qtd);
      const manter = c.ids[0];
      const excluir = c.ids.slice(1);
      console.log(`  Nome: "${c.nome_norm}"`);
      console.log(`    → Manter (mais antiga): ${manter}`);
      console.log(`    → Excluir: ${excluir.join(", ")}`);
      console.log("");
    }
  } else {
    console.log("✅ Nenhuma categoria duplicada.\n");
  }

  // 2. Itens de verificação duplicados
  const itens = await prisma.$queryRaw<
    {
      disciplina: string;
      categoria: string;
      item_preview: string;
      qtd: bigint;
      ids: string[];
      created_ats: string[];
    }[]
  >`
    SELECT
      d.nome AS disciplina,
      c.nome AS categoria,
      LEFT(TRIM(t."itemVerificacao"), 100) AS item_preview,
      count(*)::int AS qtd,
      array_agg(t.id::text ORDER BY t."createdAt", t.id) AS ids,
      array_agg(t."createdAt"::text ORDER BY t."createdAt", t.id) AS created_ats
    FROM tbl_checklist_template t
    JOIN dim_disciplinas d ON d.id = t."disciplinaId"
    JOIN dim_categorias c ON c.id = t."categoriaId"
    GROUP BY t."disciplinaId", t."categoriaId", TRIM(t."itemVerificacao"), d.nome, c.nome
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `;

  if (itens.length > 0) {
    console.log("📋 ITENS DE VERIFICAÇÃO DUPLICADOS:\n");
    for (const i of itens) {
      const qtd = Number(i.qtd);
      const manter = i.ids[0];
      const excluir = i.ids.slice(1);
      console.log(`  [${i.disciplina} / ${i.categoria}]`);
      console.log(`    Texto: "${i.item_preview}${(i.item_preview?.length || 0) >= 100 ? "..." : ""}"`);
      console.log(`    → Manter (mais antigo): ${manter}`);
      console.log(`    → Excluir (${excluir.length} duplicata(s)): ${excluir.join(", ")}`);
      console.log("");
    }
  } else {
    console.log("✅ Nenhum item de verificação duplicado.\n");
  }

  const totalCatDup = categorias.reduce((s, c) => s + Number(c.qtd) - 1, 0);
  const totalItemDup = itens.reduce((s, i) => s + Number(i.qtd) - 1, 0);
  console.log("───────────────────────────────────────────────────────────────");
  console.log(`  Resumo: ${totalCatDup} categorias e ${totalItemDup} itens seriam removidos`);
  console.log("  (Execute supabase/deduplicate-library.sql para aplicar)\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
