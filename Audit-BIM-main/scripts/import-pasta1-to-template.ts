/**
 * Importa itens da planilha Pasta1.xlsx para tbl_checklist_template (Supabase).
 * Regras de cor/coluna Disciplina:
 *   Verde / TODOS = todas as disciplinas
 *   Laranja / TODOS MENOS EST E EMT = todas exceto EST e EMT
 *   Amarelo / AIT = só AIT
 *   Roxo / ARQ = só ARQ (AQR)
 *   Azul / EST E EMT = só EST e EMT
 *
 * Gera um registro em tbl_checklist_template por (item × disciplina aplicável).
 * Uso: npx tsx import-pasta1-to-template.ts ../Pasta1.xlsx
 */

import * as XLSX from "xlsx";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

// IDs de dim_categorias (nome → id) - preenchidos conforme dim_categorias no Supabase
const CATEGORIA_ID: Record<string, string> = {
  "Nomenclatura de Arquivos e Modelos": "aebeea8e-9058-46c4-965d-9f946c0895b6",
  "Ponto de Origem": "d06c2556-9f01-4097-9c18-b3c0f3c944ff",
  "Sistema de Unidades": "11c2e9ea-0ce1-45c2-9db2-fee38cb91f53",
  "Níveis": "c0b58088-6673-496e-ae16-0302058b8f99",
  "Opções de Projeto (Design Options)": "bb346144-709b-42c0-9561-0e89d3f2d9d3",
  "Vínculos RVT": "cd095ce8-2e24-4b1b-8905-18c74219b56c",
  "Vinculos RVT": "cd095ce8-2e24-4b1b-8905-18c74219b56c",
  "Elementos modelados": "e79ea9b7-8ce0-40b4-af9c-8133694a6d4e",
  "Elementos Modelados": "e79ea9b7-8ce0-40b4-af9c-8133694a6d4e",
  "Materiais": "263bb423-3c26-47ed-84e1-a827726fd787",
  "Duplicações": "8532cac2-537c-46de-981d-4162065926ef",
  "Paredes": "ee78e7e0-e9ba-47a6-9af1-33a3e2f03722",
  "Pisos": "3f2cb4d1-42b3-4c57-9b57-876b7131d74e",
  "Requisitos de modelagem (Parâmetros e Classificações)": "67d92f3b-ad88-426b-964b-340dd06c985f",
  "Requisitos de Modelagem (Parâmetros e Classificações)": "67d92f3b-ad88-426b-964b-340dd06c985f",
  "Rodapés": "6137f96f-a7ed-44b1-86ea-15d3f7268a92",
  "Bancadas": "17fb7205-37d2-4567-89ed-e4f63f34b085",
};

// Código → id em dim_disciplinas
const DISCIPLINA_ID: Record<string, string> = {
  AIT: "78e3c46a-ce60-4779-8bc1-d155eb6e110f",
  APS: "5e9680bf-6b70-439d-ad5b-a7ba1c77d6a8",
  ARQ: "82c2afea-07e4-462e-9702-a0fedb186aa6",
  CLI: "fed7f56f-9b96-4308-ad6c-54bf87d3ff9f",
  CPR: "42e9496c-511c-404f-9ef9-7a5f0ec0ab7b",
  ELE: "5d33cbd3-7c99-4a15-ae8b-c112ca36bbb2",
  ELS: "1e0b2735-939f-4a07-a8de-8dce3ba1707b",
  EMT: "dca3a387-5f4d-450a-b621-291c079cb4af",
  EPR: "66e946e2-c63d-4663-8b7e-c4d9264eeec3",
  EST: "ee2f4593-778d-42fe-bf52-8d8229fc6752",
  HGA: "6eefe453-2c1b-473e-aeb9-52b9cc1f6b01",
  HID: "a9872483-3d81-4ff6-b508-b9e168183315",
  HIN: "c75840cb-c389-4c2c-910e-67c45c632dec",
  HSP: "c6f38617-8a64-4f4a-a0b0-971a32934c33",
  IMP: "9c8fb6f8-6018-4f05-91ff-90d4c019ea7d",
  IRR: "cb70fc4c-ce5e-40ec-9d62-1759a440c7a1",
  SPDA: "16cf6679-f41b-4dfd-81f1-305a3bb4406f",
};

const TODAS_DISCIPLINAS = Object.keys(DISCIPLINA_ID);
const TODAS_MENOS_EST_EMT = TODAS_DISCIPLINAS.filter((c) => c !== "EST" && c !== "EMT");

function getDisciplinaIdsByRule(rule: string): string[] {
  const r = String(rule ?? "").trim().toUpperCase();
  if (!r) return [];
  if (r === "TODOS" || r === "TODAS AS DISCIPLINAS") return TODAS_DISCIPLINAS.map((c) => DISCIPLINA_ID[c]!);
  if (r === "TODOS MENOS EST E EMT") return TODAS_MENOS_EST_EMT.map((c) => DISCIPLINA_ID[c]!);
  if (r === "AIT" || r === "SÓ AIT") return [DISCIPLINA_ID.AIT!];
  if (r === "ARQ" || r === "AQR" || r === "SÓ AQR") return [DISCIPLINA_ID.ARQ!];
  if (r === "EST E EMT" || r === "SÓ EST E EMT") return [DISCIPLINA_ID.EST!, DISCIPLINA_ID.EMT!];
  return [];
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

interface Row {
  categoriaId: string;
  disciplinaId: string;
  itemVerificacao: string;
  peso: number;
  pontosMaximo: number;
  ordemExibicao: number;
}

function main(): Row[] {
  const relPath = process.argv[2] || "../Pasta1.xlsx";
  const filePath = join(scriptDir, relPath);
  if (!existsSync(filePath)) {
    console.error("Arquivo não encontrado:", filePath);
    process.exit(1);
  }
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  console.error("Linhas lidas da planilha:", rows.length);
  const out: Row[] = [];
  let ordemGlobal = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const categoriaNome = String(r["Categorias"] ?? "").trim();
    const itemVerificacao = String(r["Itens de verificação"] ?? "").trim();
    if (!itemVerificacao) continue;
    const categoriaId = CATEGORIA_ID[categoriaNome];
    if (!categoriaId) {
      console.warn(`Linha ${i + 2}: Categoria não mapeada: "${categoriaNome}"`);
      continue;
    }
    const peso = Math.max(1, Number(r["Peso"]) || 1);
    const pontosMaximoRaw = r["Pontos máximo"] ?? r["Pontos"];
    const pontosMaximo = Math.max(0, Number(pontosMaximoRaw) || 3);
    const rule = (r["__EMPTY_6"] ?? r["Disciplina"] ?? "") as string;
    const disciplinaIds = getDisciplinaIdsByRule(rule);
    if (disciplinaIds.length === 0) {
      console.warn(`Linha ${i + 2}: Nenhuma disciplina para regra: "${rule}"`);
      continue;
    }
    for (const disciplinaId of disciplinaIds) {
      out.push({
        categoriaId,
        disciplinaId,
        itemVerificacao,
        peso,
        pontosMaximo,
        ordemExibicao: ordemGlobal++,
      });
    }
  }
  return out;
}

const rows = main();
console.error("Total de linhas a inserir:", rows.length);

const outSql = process.argv.includes("--sql");
const sqlFile = process.argv.find((a) => a.startsWith("--sql-file="))?.slice("--sql-file=".length);
if (outSql || sqlFile) {
  const values = rows
    .map(
      (r) =>
        `(1, '${r.disciplinaId}', '${r.categoriaId}', ${escapeSqlLiteral(r.itemVerificacao)}, ${r.peso}, ${r.pontosMaximo}, ${r.ordemExibicao})`
    )
    .join(",\n");
  const sql = `INSERT INTO tbl_checklist_template (versao, "disciplinaId", "categoriaId", "itemVerificacao", peso, "pontosMaximo", "ordemExibicao")\nVALUES\n${values};`;
  if (sqlFile) {
    writeFileSync(join(scriptDir, sqlFile), sql, "utf8");
    console.error("SQL gravado em", join(scriptDir, sqlFile), "(UTF-8). Execute no Supabase SQL Editor.");
  } else {
    console.log(sql);
  }
} else {
  console.log(JSON.stringify(rows));
}

function escapeSqlLiteral(s: string): string {
  return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}
