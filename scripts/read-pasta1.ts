/**
 * Lê Pasta1.xlsx e exibe estrutura (cabeçalhos e primeiras linhas) para mapeamento.
 * Uso: npx tsx read-pasta1.ts ../Pasta1.xlsx
 */
import * as XLSX from "xlsx";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function main() {
  const relPath = process.argv[2] || "../Pasta1.xlsx";
  const filePath = join(scriptDir, relPath);
  if (!existsSync(filePath)) {
    console.error("Arquivo não encontrado:", filePath);
    process.exit(1);
  }
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer", cellDates: true });
  const firstSheet = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: null }) as unknown[][];
  console.log("Aba:", firstSheet);
  console.log("Total de linhas:", rows.length);
  if (rows.length > 0) {
    console.log("\nCabeçalho (linha 0):", JSON.stringify(rows[0], null, 0));
    console.log("\nPrimeiras 5 linhas (dados):");
    for (let i = 1; i <= Math.min(5, rows.length - 1); i++) {
      console.log("Linha", i, ":", JSON.stringify(rows[i], null, 0));
    }
    // Com header como chave (para ver nomes das colunas)
    const asObj = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    console.log("\nNomes das colunas (keys do primeiro objeto):", asObj.length ? Object.keys(asObj[0]!) : []);
    if (asObj.length > 0) {
      console.log("\nExemplo linha 1 como objeto:", asObj[0]);
    }
  }
}

main();
