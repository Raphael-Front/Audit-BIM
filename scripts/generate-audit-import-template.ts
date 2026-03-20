/**
 * Gera um template .xlsx para migração de auditorias.
 * Formato: aba única (singleSheet) compatível com import-config.json.
 *
 * Uso: npx tsx scripts/generate-audit-import-template.ts [caminho-saida.xlsx]
 */

import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const COLUNAS = [
  "Obra",
  "Fase",
  "Disciplina",
  "Categoria",
  "Itens de verificação",
  "Status",
  "Evidência/Observação",
  "CF",
  "Proxima revisão",
  "Peso",
  "Pontos",
] as const;

const STATUS_VALIDOS = "conforme | nao_conforme | pendente | observacao | na | corrigido";
const EXEMPLO_LINHA = {
  Obra: "OBRA-001",
  Fase: "Fundação",
  Disciplina: "Estrutural",
  Categoria: "Conformidade",
  "Itens de verificação": "Verificar armadura conforme projeto",
  Status: "conforme",
  "Evidência/Observação": "Fotos anexadas",
  CF: "",
  "Proxima revisão": "2025-03-15",
  Peso: 1,
  Pontos: 10,
};

function gerarTemplate(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Linhas de exemplo
  const dados = [
    COLUNAS,
    Object.values(EXEMPLO_LINHA),
    ["OBRA-001", "Fundação", "Estrutural", "Conformidade", "Verificar concretagem", "pendente", "", "", "", 1, ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(dados);

  // Largura das colunas
  ws["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 45 },
    { wch: 14 },
    { wch: 25 },
    { wch: 12 },
    { wch: 16 },
    { wch: 6 },
    { wch: 8 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Auditorias");

  return wb;
}

function main(): void {
  const outPath = process.argv[2] || join(scriptDir, "template-migracao-auditorias.xlsx");
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const wb = gerarTemplate();
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  writeFileSync(outPath, buf);
  console.log("Template gerado:", outPath);
  console.log("");
  console.log("Colunas do template:");
  COLUNAS.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log("");
  console.log("Regras:");
  console.log("  - Obra + Fase + Disciplina definem uma auditoria.");
  console.log("  - Células vazias em Obra/Fase/Disciplina repetem o valor da linha anterior.");
  console.log(`  - Status: ${STATUS_VALIDOS}`);
  console.log("  - Peso: 1-5 (padrão 1). Pontos: 0-10 conforme item.");
}

main();
