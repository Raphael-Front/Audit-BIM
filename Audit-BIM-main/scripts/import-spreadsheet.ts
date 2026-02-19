/**
 * Script de importação da planilha para o sistema (Prisma/PostgreSQL).
 * Mapeia colunas configuráveis e insere na ordem: User, Work, Phase, Discipline, Category,
 * AuditPhase, ChecklistItem, Audit, AuditItem. Gera log de sucessos e erros.
 */

import { config as loadEnv } from "dotenv";
import * as XLSX from "xlsx";
import { PrismaClient, getPrismaClient } from "../packages/db/src/index.ts";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

// Carrega .env: raiz do projeto primeiro, depois scripts/ (permite rodar npm run import da raiz)
const rootDir = join(scriptDir, "..");
const rootEnv = join(rootDir, ".env");
const scriptsEnv = join(scriptDir, ".env");
if (existsSync(rootEnv)) loadEnv({ path: rootEnv });
if (existsSync(scriptsEnv)) loadEnv({ path: scriptsEnv, override: false }); // scripts/.env só preenche se ainda não definido

const BATCH_SIZE = 100;
const LOG_DIR = scriptDir;
const SALT_ROUNDS = 10;

type LogEntry = { line?: number; message: string; entity?: string };
const logEntries: LogEntry[] = [];

function log(message: string, entity?: string, line?: number) {
  const entry: LogEntry = { message, entity, line };
  logEntries.push(entry);
  console.log(entity ? `[${entity}] ${message}` : message);
}

interface SheetConfig {
  sheetName: string;
  columns: Record<string, string>;
}

/** Mapeamento coluna planilha → campo interno (singleSheet). */
interface SingleSheetColumns {
  obra: string;
  fase: string;
  disciplina: string;
  categoria: string;
  itensVerificacao: string;
  status: string;
  evidenciaObservacao: string;
  cf: string;
  proximaRevisao: string;
  peso: string;
  pontos: string;
}

interface SingleSheetConfig {
  enabled: boolean;
  sheetName?: string;
  /** Linha (1-based) onde estão os cabeçalhos na aba. Use quando a tabela não começa na linha 1 (ex.: título/logo acima). */
  headerRowIndex?: number;
  columns: SingleSheetColumns;
  /** Nome da fase de obra criada por obra (ex.: "Geral"). */
  defaultPhaseName?: string;
  /** Email do usuário usado como auditor/criador quando não há aba Usuários. */
  defaultAuditorEmail?: string;
}

interface ImportConfig {
  databaseUrl?: string;
  onDuplicate?: "skip" | "merge";
  singleSheet?: SingleSheetConfig;
  sheets?: Record<string, SheetConfig>;
}

function loadConfig(): ImportConfig {
  const configPath = join(scriptDir, "import-config.json");
  if (!existsSync(configPath)) {
    throw new Error("import-config.json não encontrado em " + scriptDir + ". Copie import-config.example.json e ajuste.");
  }
  return JSON.parse(readFileSync(configPath, "utf-8")) as ImportConfig;
}

function readWorkbook(filePath: string): XLSX.WorkBook {
  if (!existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
  const buf = readFileSync(filePath);
  return XLSX.read(buf, { type: "buffer", cellDates: true });
}

function getSheetRows(
  wb: XLSX.WorkBook,
  sheetName: string,
  options?: { headerRowIndex?: number }
): Record<string, unknown>[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const opts: Parameters<typeof XLSX.utils.sheet_to_json>[1] = { defval: null, raw: false };
  if (options?.headerRowIndex != null && options.headerRowIndex > 0) {
    const r = options.headerRowIndex;
    opts.range = r - 1; // SheetJS: 0-based row index to start reading (that row = headers)
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, opts);
}

/** Linha normalizada a partir do singleSheet (colunas da planilha mapeadas para nomes internos). */
interface NormalizedSingleRow {
  obra: string;
  fase: string;
  disciplina: string;
  categoria: string;
  itensVerificacao: string;
  status: string;
  evidenciaObservacao: string;
  cf: string;
  proximaRevisao: Date | null;
  peso: number;
  pontos: number | null;
}

/**
 * Lê e normaliza a planilha única.
 * Regra de auditoria: Obra + Fase + Disciplina definem uma auditoria.
 * Quando qualquer um desses 3 campos muda, inicia nova auditoria.
 * Células vazias de Obra/Fase/Disciplina são preenchidas com o último valor
 * conhecido (propagação/fill-down), para agrupar corretamente os itens.
 */
function readAndNormalizeSingleSheet(
  wb: XLSX.WorkBook,
  singleSheet: SingleSheetConfig
): NormalizedSingleRow[] {
  const sheetName = singleSheet.sheetName || wb.SheetNames[0];
  const rawRows = getSheetRows(wb, sheetName, {
    headerRowIndex: singleSheet.headerRowIndex,
  });
  const c = singleSheet.columns;

  let lastObra = "";
  let lastFase = "";
  let lastDisciplina = "";

  const normalized = rawRows
    .map((row) => {
      const obraRaw = String((row[c.obra] ?? "").toString()).trim();
      const faseRaw = String((row[c.fase] ?? "").toString()).trim();
      const disciplinaRaw = String((row[c.disciplina] ?? "").toString()).trim();

      // Propagar valores vazios: usar o último conhecido (regra: mudança = nova auditoria)
      const obra = obraRaw !== "" ? (lastObra = obraRaw) : lastObra;
      const fase = faseRaw !== "" ? (lastFase = faseRaw) : lastFase;
      const disciplina = disciplinaRaw !== "" ? (lastDisciplina = disciplinaRaw) : lastDisciplina;

      const categoria = String((row[c.categoria] ?? "").toString()).trim();
      const itensVerificacao = String((row[c.itensVerificacao] ?? "").toString()).trim();
      const status = String((row[c.status] ?? "").toString()).trim();
      const evidenciaObservacao = String((row[c.evidenciaObservacao] ?? "").toString()).trim();
      const cf = String((row[c.cf] ?? "").toString()).trim();
      const proximaRevisao = parseDate(row[c.proximaRevisao]);
      const peso = row[c.peso] != null && row[c.peso] !== "" ? Number(row[c.peso]) : 1;
      const pontos = row[c.pontos] != null && row[c.pontos] !== "" ? Number(row[c.pontos]) : null;
      return {
        obra,
        fase,
        disciplina,
        categoria,
        itensVerificacao,
        status,
        evidenciaObservacao,
        cf,
        proximaRevisao,
        peso: Number.isNaN(peso) ? 1 : peso,
        pontos: pontos != null && !Number.isNaN(pontos) ? pontos : null,
      };
    })
    .filter((r) => r.obra !== "" || r.disciplina !== "" || r.itensVerificacao !== "");

  return normalized;
}

/** Gera linhas virtuais e config para import quando singleSheet está ativo. */
function buildVirtualRowsFromSingleSheet(
  normalized: NormalizedSingleRow[],
  singleSheet: SingleSheetConfig
): {
  workRows: Record<string, unknown>[];
  phaseRows: Record<string, unknown>[];
  disciplineRows: Record<string, unknown>[];
  categoryRows: Record<string, unknown>[];
  auditPhaseRows: Record<string, unknown>[];
  checklistItemRows: Record<string, unknown>[];
  auditRows: Record<string, unknown>[];
  auditItemRows: Record<string, unknown>[];
  virtualSheets: ImportConfig["sheets"];
} {
  const defaultPhase = singleSheet.defaultPhaseName ?? "Geral";
  const workNames = [...new Set(normalized.map((r) => r.obra).filter(Boolean))];
  const phaseNames = [...new Set(normalized.map((r) => r.fase).filter(Boolean))];
  const disciplineNames = [...new Set(normalized.map((r) => r.disciplina).filter(Boolean))];
  const categoryKeys = new Map<string, { disciplina: string; categoria: string }>();
  for (const r of normalized) {
    if (r.disciplina && r.categoria) {
      const key = `${r.disciplina}::${r.categoria}`;
      if (!categoryKeys.has(key)) categoryKeys.set(key, { disciplina: r.disciplina, categoria: r.categoria });
    }
  }
  const checklistKeys = new Map<
    string,
    { disciplina: string; categoria: string; fase: string; description: string; peso: number }
  >();
  for (const r of normalized) {
    if (r.disciplina && r.categoria && r.fase && r.itensVerificacao) {
      const key = `${r.disciplina}::${r.categoria}::${r.fase}::${r.itensVerificacao.slice(0, 80)}`;
      if (!checklistKeys.has(key))
        checklistKeys.set(key, {
          disciplina: r.disciplina,
          categoria: r.categoria,
          fase: r.fase,
          description: r.itensVerificacao,
          peso: r.peso,
        });
    }
  }
  const auditKeys = new Set<string>();
  for (const r of normalized) {
    if (r.obra && r.fase && r.disciplina) auditKeys.add(`${r.obra}\t${r.fase}\t${r.disciplina}`);
  }

  const workRows: Record<string, unknown>[] = workNames.map((name) => ({ name, code: undefined, active: true }));
  const phaseRows: Record<string, unknown>[] = workNames.map((workCode) => ({
    workCode,
    name: defaultPhase,
    order: 0,
    active: true,
  }));
  const disciplineRows: Record<string, unknown>[] = disciplineNames.map((name) => ({ name, order: 0, active: true }));
  const categoryRows: Record<string, unknown>[] = [...categoryKeys.values()].map(({ disciplina, categoria }) => ({
    disciplineName: disciplina,
    name: categoria,
    order: 0,
    active: true,
  }));
  const auditPhaseRows: Record<string, unknown>[] = phaseNames.map((name) => ({
    name,
    label: name,
    order: 0,
    active: true,
  }));
  const checklistItemRows: Record<string, unknown>[] = [...checklistKeys.values()].map(
    ({ disciplina, categoria, fase, description, peso }) => ({
      disciplineName: disciplina,
      categoryName: categoria,
      auditPhaseName: fase,
      description,
      weight: peso,
      maxPoints: 10,
      active: true,
    })
  );
  const auditTitles = [...auditKeys].map((k) => {
    const [o, f, d] = k.split("\t");
    return { key: k, title: `${o} - ${f} - ${d}` };
  });
  const auditRows: Record<string, unknown>[] = auditTitles.map(({ title }) => ({
    workCode: title.split(" - ")[0],
    phaseName: defaultPhase,
    disciplineName: title.split(" - ")[2],
    auditPhaseName: title.split(" - ")[1],
    title,
    startDate: new Date(),
    status: "IN_PROGRESS",
    auditorEmail: singleSheet.defaultAuditorEmail ?? "",
    createdByEmail: singleSheet.defaultAuditorEmail ?? "",
  }));
  const auditItemRows: Record<string, unknown>[] = normalized.map((r) => ({
    auditTitle: `${r.obra} - ${r.fase} - ${r.disciplina}`,
    disciplineName: r.disciplina,
    categoryName: r.categoria,
    auditPhaseName: r.fase,
    description: r.itensVerificacao,
    status: r.status,
    evidenceText: r.evidenciaObservacao || undefined,
    construflowRef: r.cf || undefined,
    nextReviewAt: r.proximaRevisao ?? undefined,
    pointsObtained: r.pontos ?? undefined,
  }));

  const virtualSheets: ImportConfig["sheets"] = {
    Work: { sheetName: "_", columns: { name: "name", code: "code", active: "active" } },
    Phase: { sheetName: "_", columns: { workCode: "workCode", name: "name", order: "order", active: "active" } },
    Discipline: { sheetName: "_", columns: { name: "name", order: "order", active: "active" } },
    Category: {
      sheetName: "_",
      columns: { disciplineName: "disciplineName", name: "name", order: "order", active: "active" },
    },
    AuditPhase: { sheetName: "_", columns: { name: "name", label: "label", order: "order", active: "active" } },
    ChecklistItem: {
      sheetName: "_",
      columns: {
        disciplineName: "disciplineName",
        categoryName: "categoryName",
        auditPhaseName: "auditPhaseName",
        description: "description",
        weight: "weight",
        maxPoints: "maxPoints",
        active: "active",
      },
    },
    Audit: {
      sheetName: "_",
      columns: {
        workCode: "workCode",
        phaseName: "phaseName",
        disciplineName: "disciplineName",
        auditPhaseName: "auditPhaseName",
        title: "title",
        startDate: "startDate",
        status: "status",
        auditorEmail: "auditorEmail",
        createdByEmail: "createdByEmail",
      },
    },
    AuditItem: {
      sheetName: "_",
      columns: {
        auditTitle: "auditTitle",
        disciplineName: "disciplineName",
        categoryName: "categoryName",
        auditPhaseName: "auditPhaseName",
        description: "description",
        status: "status",
        evidenceText: "evidenceText",
        construflowRef: "construflowRef",
        nextReviewAt: "nextReviewAt",
        pointsObtained: "pointsObtained",
      },
    },
  };

  return {
    workRows,
    phaseRows,
    disciplineRows,
    categoryRows,
    auditPhaseRows,
    checklistItemRows,
    auditRows,
    auditItemRows,
    virtualSheets,
  };
}

function mapRow(row: Record<string, unknown>, columns: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [dbField, sheetCol] of Object.entries(columns)) {
    const val = row[sheetCol];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      out[dbField] = val;
    }
  }
  return out;
}

function parseDate(val: unknown): Date | null {
  if (val == null) return null;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "number" && val >= 25569) {
    return new Date((val - 25569) * 86400 * 1000);
  }
  return null;
}

const ROLE_MAP: Record<string, "ADMIN" | "AUDITOR" | "READER"> = {
  admin: "ADMIN",
  auditor: "AUDITOR",
  leitor: "READER",
  reader: "READER",
};

const STATUS_MAP: Record<string, "IN_PROGRESS" | "WAITING_FOR_ISSUES" | "COMPLETED" | "CANCELED"> = {
  em_andamento: "IN_PROGRESS",
  "em andamento": "IN_PROGRESS",
  aguardando: "WAITING_FOR_ISSUES",
  aguardando_apontamentos: "WAITING_FOR_ISSUES",
  concluida: "COMPLETED",
  concluída: "COMPLETED",
  cancelada: "CANCELED",
};

const ITEM_STATUS_MAP: Record<string, "NOT_STARTED" | "CONFORMING" | "NONCONFORMING" | "OBSERVATION" | "NA"> = {
  pendente: "NOT_STARTED",
  conforme: "CONFORMING",
  nao_conforme: "NONCONFORMING",
  "não conforme": "NONCONFORMING",
  observacao: "OBSERVATION",
  na: "NA",
  "n/a": "NA",
};

async function importUsers(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.User;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const email = String((raw.email ?? raw["Email"] ?? "").toString()).trim().toLowerCase();
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    const passwordRaw = raw.password ?? raw["Senha"];
    if (!email || !name) {
      log(`Linha ${i + 2}: email e nome obrigatórios`, "User", i + 2);
      errors++;
      continue;
    }
    if (config.onDuplicate === "skip") {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        map.set(email, existing.id);
        continue;
      }
    }
    const roleRaw = String((raw.role ?? raw["Perfil"] ?? "AUDITOR").toString()).toLowerCase();
    const role = ROLE_MAP[roleRaw] ?? "AUDITOR";
    const password = passwordRaw ? await bcrypt.hash(String(passwordRaw), SALT_ROUNDS) : await bcrypt.hash("Trocar@123", SALT_ROUNDS);
    try {
      const user = await prisma.user.create({ data: { name, email, password, role } });
      map.set(email, user.id);
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "User", i + 2);
      errors++;
    }
  }
  log(`User: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

/** Obra (Work): sempre pula se já existir — tabela inalterável. */
async function importWorks(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.Work;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    if (!name) {
      log(`Linha ${i + 2}: nome obrigatório`, "Work", i + 2);
      errors++;
      continue;
    }
    const code = raw.code ?? raw["Código"] ? String(raw.code ?? raw["Código"]).trim() : null;
    // Tabela inalterável: sempre pular se já existir (por código ou nome)
    const existing = code
      ? await prisma.work.findUnique({ where: { code } })
      : await prisma.work.findFirst({ where: { name } });
    if (existing) {
      if (code) map.set(code, existing.id);
      map.set(name, existing.id);
      continue;
    }
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      const work = await prisma.work.create({ data: { name, code: code || undefined, active } });
      if (code) map.set(code, work.id);
      map.set(name, work.id);
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "Work", i + 2);
      errors++;
    }
  }
  log(`Work: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

/** Fase (Phase): sempre pula se já existir — tabela inalterável. */
async function importPhases(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig, workIdByCode: Map<string, string>): Promise<void> {
  const sheetConfig = config.sheets?.Phase;
  if (!sheetConfig || rows.length === 0) return;
  const cols = sheetConfig.columns;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const workCode = String((raw.workCode ?? raw["Obra Código"] ?? "").toString()).trim();
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    if (!workCode || !name) {
      log(`Linha ${i + 2}: obra e nome obrigatórios`, "Phase", i + 2);
      errors++;
      continue;
    }
    const workId = workIdByCode.get(workCode);
    if (!workId) {
      log(`Linha ${i + 2}: obra "${workCode}" não encontrada`, "Phase", i + 2);
      errors++;
      continue;
    }
    // Tabela inalterável: sempre pular se fase já existir para esta obra
    const existing = await prisma.phase.findFirst({ where: { workId, name } });
    if (existing) continue;

    const order = raw.order ?? raw["Ordem"] != null ? Number(raw.order ?? raw["Ordem"]) || 0 : 0;
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      await prisma.phase.create({ data: { workId, name, order, active } });
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "Phase", i + 2);
      errors++;
    }
  }
  log(`Phase: ${inserted} inseridos, ${errors} erros.`);
}

/** Disciplina (Discipline): sempre pula se já existir — tabela inalterável. */
async function importDisciplines(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.Discipline;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    if (!name) {
      log(`Linha ${i + 2}: nome obrigatório`, "Discipline", i + 2);
      errors++;
      continue;
    }
    // Tabela inalterável: sempre pular se já existir
    const existing = await prisma.discipline.findUnique({ where: { name } });
    if (existing) {
      map.set(name, existing.id);
      continue;
    }
    const order = raw.order ?? raw["Ordem"] != null ? Number(raw.order ?? raw["Ordem"]) || 0 : 0;
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      const d = await prisma.discipline.create({ data: { name, order, active } });
      map.set(name, d.id);
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "Discipline", i + 2);
      errors++;
    }
  }
  log(`Discipline: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

async function importCategories(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig, disciplineIdByName: Map<string, string>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.Category;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const disciplineName = String((raw.disciplineName ?? raw["Disciplina"] ?? "").toString()).trim();
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    if (!disciplineName || !name) {
      log(`Linha ${i + 2}: disciplina e nome obrigatórios`, "Category", i + 2);
      errors++;
      continue;
    }
    const disciplineId = disciplineIdByName.get(disciplineName);
    if (!disciplineId) {
      log(`Linha ${i + 2}: disciplina "${disciplineName}" não encontrada`, "Category", i + 2);
      errors++;
      continue;
    }
    const order = raw.order ?? raw["Ordem"] != null ? Number(raw.order ?? raw["Ordem"]) || 0 : 0;
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      const c = await prisma.category.create({ data: { disciplineId, name, order, active } });
      map.set(`${disciplineName}::${name}`, c.id);
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "Category", i + 2);
      errors++;
    }
  }
  log(`Category: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

/** Fase Auditoria (AuditPhase): sempre pula se já existir — tabela inalterável. */
async function importAuditPhases(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.AuditPhase;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    const label = String((raw.label ?? raw["Label"] ?? name).toString()).trim();
    if (!name) {
      log(`Linha ${i + 2}: nome obrigatório`, "AuditPhase", i + 2);
      errors++;
      continue;
    }
    // Tabela inalterável: sempre pular se já existir
    const existing = await prisma.auditPhase.findUnique({ where: { name } });
    if (existing) {
      map.set(name, existing.id);
      continue;
    }
    const order = raw.order ?? raw["Ordem"] != null ? Number(raw.order ?? raw["Ordem"]) || 0 : 0;
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      const a = await prisma.auditPhase.create({ data: { name, label, order, active } });
      map.set(name, a.id);
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "AuditPhase", i + 2);
      errors++;
    }
  }
  log(`AuditPhase: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

async function importChecklistItems(
  prisma: PrismaClient,
  rows: Record<string, unknown>[],
  config: ImportConfig,
  categoryIdByKey: Map<string, string>,
  auditPhaseIdByName: Map<string, string>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.ChecklistItem;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const disciplineName = String((raw.disciplineName ?? raw["Disciplina"] ?? "").toString()).trim();
    const categoryName = String((raw.categoryName ?? raw["Categoria"] ?? "").toString()).trim();
    const auditPhaseName = String((raw.auditPhaseName ?? raw["Fase Auditoria"] ?? "").toString()).trim();
    const description = String((raw.description ?? raw["Descrição"] ?? "").toString()).trim();
    if (!description) {
      log(`Linha ${i + 2}: descrição obrigatória`, "ChecklistItem", i + 2);
      errors++;
      continue;
    }
    const categoryKey = disciplineName && categoryName ? `${disciplineName}::${categoryName}` : null;
    const categoryId = categoryKey ? categoryIdByKey.get(categoryKey) : null;
    const auditPhaseId = auditPhaseName ? auditPhaseIdByName.get(auditPhaseName) : null;
    if (!categoryId || !auditPhaseId) {
      log(`Linha ${i + 2}: categoria ou fase auditoria não encontrados`, "ChecklistItem", i + 2);
      errors++;
      continue;
    }
    const code = raw.code ?? raw["Código"] ? String(raw.code ?? raw["Código"]).trim() : null;
    const weight = raw.weight ?? raw["Peso"] != null ? Number(raw.weight ?? raw["Peso"]) || 1 : 1;
    const maxPoints = raw.maxPoints ?? raw["Pontos Máx"] != null ? Number(raw.maxPoints ?? raw["Pontos Máx"]) || 10 : 10;
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      const item = await prisma.checklistItem.create({
        data: { categoryId, auditPhaseId, code: code || undefined, description, weight, maxPoints, active },
      });
      const key = code ? `${auditPhaseId}:${categoryId}:${code}` : `${auditPhaseId}:${categoryId}:${description.slice(0, 50)}`;
      map.set(key, item.id);
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "ChecklistItem", i + 2);
      errors++;
    }
  }
  log(`ChecklistItem: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

async function importAudits(
  prisma: PrismaClient,
  rows: Record<string, unknown>[],
  config: ImportConfig,
  workIdByCode: Map<string, string>,
  userIdByEmail: Map<string, string>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.Audit;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  const phasesByWork = new Map<string, { id: string; name: string }[]>();
  const disciplines = await prisma.discipline.findMany({ select: { id: true, name: true } });
  const disciplineIdByName = new Map(disciplines.map((d: { id: string; name: string }) => [d.name, d.id]));
  const auditPhases = await prisma.auditPhase.findMany({ select: { id: true, name: true } });
  const auditPhaseIdByName = new Map(auditPhases.map((a: { id: string; name: string }) => [a.name, a.id]));
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const workCode = String((raw.workCode ?? raw["Obra Código"] ?? "").toString()).trim();
    const phaseName = String((raw.phaseName ?? raw["Fase Nome"] ?? "").toString()).trim();
    const disciplineName = String((raw.disciplineName ?? raw["Disciplina"] ?? "").toString()).trim();
    const auditPhaseName = String((raw.auditPhaseName ?? raw["Fase Auditoria"] ?? "").toString()).trim();
    const title = String((raw.title ?? raw["Título"] ?? `Auditoria ${i + 1}`).toString()).trim();
    const startDate = parseDate(raw.startDate ?? raw["Data Início"]) ?? new Date();
    const auditorEmail = String((raw.auditorEmail ?? raw["Auditor Email"] ?? "").toString()).trim().toLowerCase();
    const createdByEmail = String((raw.createdByEmail ?? raw["Criado Por Email"] ?? auditorEmail).toString()).trim().toLowerCase();
    const workId = workIdByCode.get(workCode);
    if (!workId) {
      log(`Linha ${i + 2}: obra "${workCode}" não encontrada`, "Audit", i + 2);
      errors++;
      continue;
    }
    let phaseId: string | null = null;
    if (phaseName) {
      if (!phasesByWork.has(workId)) {
        const phases = await prisma.phase.findMany({ where: { workId }, select: { id: true, name: true } });
        phasesByWork.set(workId, phases);
      }
      phaseId = phasesByWork.get(workId)?.find((p) => p.name === phaseName)?.id ?? null;
    }
    if (!phaseId && phaseName) {
      const firstPhase = await prisma.phase.findFirst({ where: { workId }, select: { id: true } });
      phaseId = firstPhase?.id ?? null;
    }
    if (!phaseId) {
      log(`Linha ${i + 2}: fase não encontrada para obra`, "Audit", i + 2);
      errors++;
      continue;
    }
    const disciplineId = disciplineName ? disciplineIdByName.get(disciplineName) : null;
    const auditPhaseId = auditPhaseName ? auditPhaseIdByName.get(auditPhaseName) : null;
    if (!disciplineId || !auditPhaseId) {
      log(`Linha ${i + 2}: disciplina ou fase auditoria não encontrados`, "Audit", i + 2);
      errors++;
      continue;
    }
    const auditorId = auditorEmail ? userIdByEmail.get(auditorEmail) : null;
    const createdById = createdByEmail ? userIdByEmail.get(createdByEmail) : auditorId;
    if (!createdById || !auditorId) {
      log(`Linha ${i + 2}: auditor/criado por não encontrado`, "Audit", i + 2);
      errors++;
      continue;
    }
    const statusRaw = String((raw.status ?? raw["Status"] ?? "IN_PROGRESS").toString()).toLowerCase().replace(/\s/g, "_");
    const status = STATUS_MAP[statusRaw] ?? "IN_PROGRESS";
    const endDate = parseDate(raw.endDate ?? raw["Data Fim"]);
    try {
      const audit = await prisma.audit.create({
        data: {
          workId,
          phaseId,
          disciplineId,
          auditPhaseId,
          title,
          startDate,
          endDate: endDate ?? undefined,
          status,
          createdById,
          auditorId,
        },
      });
      map.set(title, audit.id);
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "Audit", i + 2);
      errors++;
    }
  }
  log(`Audit: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

async function importAuditItems(
  prisma: PrismaClient,
  rows: Record<string, unknown>[],
  config: ImportConfig,
  auditIdByTitle: Map<string, string>,
  checklistItemIdByKey: Map<string, string>,
  categoryIdByKey: Map<string, string>,
  auditPhaseIdByName: Map<string, string>
): Promise<void> {
  const sheetConfig = config.sheets?.AuditItem;
  if (!sheetConfig || rows.length === 0) return;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], sheetConfig.columns);
    const auditTitle = String((raw.auditTitle ?? raw["Auditoria Título"] ?? "").toString()).trim();
    const auditId = auditIdByTitle.get(auditTitle);
    if (!auditId) {
      log(`Linha ${i + 2}: auditoria "${auditTitle}" não encontrada`, "AuditItem", i + 2);
      errors++;
      continue;
    }
    let checklistItemId: string | null = null;
    const code = raw.checklistItemCode ?? raw["Item Código"];
    const categoryName = raw.categoryName ?? raw["Categoria"];
    const disciplineName = raw.disciplineName ?? raw["Disciplina"];
    const auditPhaseName = raw.auditPhaseName ?? raw["Fase Auditoria"];
    const description = raw.description ?? raw["Descrição"] ? String(raw.description ?? raw["Descrição"]).trim() : null;
    if (categoryName && disciplineName && auditPhaseName) {
      const categoryKey = `${String(disciplineName).trim()}::${String(categoryName).trim()}`;
      const categoryId = categoryIdByKey.get(categoryKey);
      const auditPhaseId = auditPhaseIdByName.get(String(auditPhaseName).trim());
      if (auditPhaseId && categoryId) {
        if (code) {
          const key = `${auditPhaseId}:${categoryId}:${String(code).trim()}`;
          checklistItemId = checklistItemIdByKey.get(key) ?? null;
        }
        if (!checklistItemId && description) {
          const descKey = `${auditPhaseId}:${categoryId}:${description.slice(0, 50)}`;
          checklistItemId = checklistItemIdByKey.get(descKey) ?? null;
        }
      }
    }
    const statusRaw = String((raw.status ?? raw["Status"] ?? "NOT_STARTED").toString()).toLowerCase().replace(/\s/g, "_");
    const status = ITEM_STATUS_MAP[statusRaw] ?? "NOT_STARTED";
    const evidenceText = raw.evidenceText ?? raw["Evidência"] ? String(raw.evidenceText ?? raw["Evidência"]).trim() : null;
    const construflowRef = raw.construflowRef ?? raw["Construflow Ref"] ? String(raw.construflowRef ?? raw["Construflow Ref"]).trim() : null;
    const nextReviewAt = parseDate(raw.nextReviewAt ?? raw["Proxima revisão"] ?? raw["Próxima revisão"]);
    const pointsObtained = raw.pointsObtained ?? raw["Pontos"] != null ? Number(raw.pointsObtained ?? raw["Pontos"]) : null;
    try {
      await prisma.auditItem.create({
        data: {
          auditId,
          checklistItemId: checklistItemId ?? undefined,
          status,
          evidenceText: evidenceText ?? undefined,
          construflowRef: construflowRef ?? undefined,
          nextReviewAt: nextReviewAt ?? undefined,
          pointsObtained: pointsObtained != null && !Number.isNaN(pointsObtained) ? pointsObtained : undefined,
        },
      });
      inserted++;
    } catch (e) {
      log(`Linha ${i + 2}: ${(e as Error).message}`, "AuditItem", i + 2);
      errors++;
    }
  }
  log(`AuditItem: ${inserted} inseridos, ${errors} erros.`);
}

function writeLogFile(): void {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = join(LOG_DIR, `import-log-${ts}.txt`);
  const lines = logEntries.map((e) => (e.line != null ? `Linha ${e.line}: ` : "") + (e.entity ? `[${e.entity}] ` : "") + e.message);
  const byEntity = new Map<string, number>();
  let errorCount = 0;
  for (const e of logEntries) {
    if (e.message.includes("erros") || e.message.includes("inseridos")) {
      const entity = e.entity ?? "";
      byEntity.set(entity, (byEntity.get(entity) ?? 0) + 1);
    }
    if (e.line != null && (e.message.includes("obrigatório") || e.message.includes("não encontrad") || e.message.includes(":"))) errorCount++;
  }
  const summary = [
    "",
    "--- Resumo ---",
    `Total de linhas com erro registrado: ${errorCount}`,
    ...Array.from(byEntity.entries()).map(([k, v]) => `${k}: ${v} mensagem(ns)`),
  ].join("\n");
  const content = lines.join("\n") + summary;
  writeFileSync(filename, content, "utf-8");
  log(`Log gravado em ${filename}`);
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npm run import -- <caminho-da-planilha.xlsx>");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Defina DATABASE_URL no ambiente ou em .env na raiz do projeto.");
    process.exit(1);
  }

  console.log("Iniciando importação...");
  const config = loadConfig();
  console.log("Config carregado. Lendo planilha...");
  const wb = readWorkbook(filePath);
  console.log("Planilha carregada. Processando aba...");

  let userRows: Record<string, unknown>[];
  let workRows: Record<string, unknown>[];
  let phaseRows: Record<string, unknown>[];
  let disciplineRows: Record<string, unknown>[];
  let categoryRows: Record<string, unknown>[];
  let auditPhaseRows: Record<string, unknown>[];
  let checklistItemRows: Record<string, unknown>[];
  let auditRows: Record<string, unknown>[];
  let auditItemRows: Record<string, unknown>[];
  let effectiveConfig = config;

  if (config.singleSheet?.enabled && config.singleSheet.columns) {
    const normalized = readAndNormalizeSingleSheet(wb, config.singleSheet);
    if (normalized.length === 0) {
      const sheetName = config.singleSheet.sheetName || wb.SheetNames[0];
      const rawRows = getSheetRows(wb, sheetName);
      const firstRowKeys = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
      console.error("Nenhuma linha válida na planilha única (Obra, Disciplina ou Itens de verificação).");
      console.error("Abas no arquivo:", wb.SheetNames.join(", "));
      console.error('Aba usada no config:', JSON.stringify(sheetName));
      console.error("Cabeçalhos na primeira linha:", firstRowKeys.length ? firstRowKeys.join(" | ") : "(nenhum)");
      console.error("No import-config.json, singleSheet.columns deve usar exatamente esses nomes (ex.: obra: \"Obra\", disciplina: \"Disciplina\", itensVerificacao: \"Itens de verificação\").");
      process.exit(1);
    }
    console.log(`${normalized.length} linhas válidas na aba. Montando dados...`);
    const virtual = buildVirtualRowsFromSingleSheet(normalized, config.singleSheet);
    workRows = virtual.workRows;
    phaseRows = virtual.phaseRows;
    disciplineRows = virtual.disciplineRows;
    categoryRows = virtual.categoryRows;
    auditPhaseRows = virtual.auditPhaseRows;
    checklistItemRows = virtual.checklistItemRows;
    auditRows = virtual.auditRows;
    auditItemRows = virtual.auditItemRows;
    effectiveConfig = { ...config, sheets: { ...config.sheets, ...virtual.virtualSheets } };
    userRows = [];
    if (!config.singleSheet.defaultAuditorEmail?.trim()) {
      console.error(
        "Com singleSheet ativo, defina singleSheet.defaultAuditorEmail no import-config.json (email de um usuário existente no banco)."
      );
      process.exit(1);
    }
  } else {
    userRows = getSheetRows(wb, config.sheets?.User?.sheetName ?? "Usuários");
    workRows = getSheetRows(wb, config.sheets?.Work?.sheetName ?? "Obras");
    phaseRows = getSheetRows(wb, config.sheets?.Phase?.sheetName ?? "Fases");
    disciplineRows = getSheetRows(wb, config.sheets?.Discipline?.sheetName ?? "Disciplinas");
    categoryRows = getSheetRows(wb, config.sheets?.Category?.sheetName ?? "Categorias");
    auditPhaseRows = getSheetRows(wb, config.sheets?.AuditPhase?.sheetName ?? "Fases Auditoria");
    checklistItemRows = getSheetRows(wb, config.sheets?.ChecklistItem?.sheetName ?? "Itens Checklist");
    auditRows = getSheetRows(wb, config.sheets?.Audit?.sheetName ?? "Auditorias");
    auditItemRows = getSheetRows(wb, config.sheets?.AuditItem?.sheetName ?? "Itens Auditoria");
  }

  console.log("Conectando ao banco e inserindo dados...");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não está definida. Coloque no .env na raiz do projeto ou em scripts/.env");
    process.exit(1);
  }
  const prisma = getPrismaClient();
  let userIdByEmail: Map<string, string>;
  try {
    userIdByEmail = await importUsers(prisma, userRows, effectiveConfig);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("denied access") || msg.includes("not available") || (e as { name?: string })?.name === "PrismaClientInitializationError") {
      console.error("");
      console.error("Erro de conexão com o banco. Verifique:");
      console.error("  1. PostgreSQL está rodando (localhost:5432)");
      console.error("  2. Usuário e senha no .env estão corretos (ex.: postgres / 123)");
      console.error("  3. O banco bim_audit existe (rode: npm run migrate:deploy no pacote db ou na raiz)");
      console.error("");
      throw e;
    }
    throw e;
  }
  if (config.singleSheet?.enabled && config.singleSheet.defaultAuditorEmail) {
    const email = config.singleSheet.defaultAuditorEmail.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`Usuário com email "${config.singleSheet.defaultAuditorEmail}" não encontrado no banco. Crie-o antes ou importe a aba Usuários.`);
      process.exit(1);
    }
    userIdByEmail = new Map(userIdByEmail);
    userIdByEmail.set(email, user.id);
  }

  console.log("Obras...");
  const workIdByCode = await importWorks(prisma, workRows, effectiveConfig);
  console.log("Fases...");
  await importPhases(prisma, phaseRows, effectiveConfig, workIdByCode);
  console.log("Disciplinas...");
  const disciplineIdByName = await importDisciplines(prisma, disciplineRows, effectiveConfig);
  console.log("Categorias...");
  const categoryIdByKey = await importCategories(prisma, categoryRows, effectiveConfig, disciplineIdByName);
  console.log("Fases de auditoria...");
  const auditPhaseIdByName = await importAuditPhases(prisma, auditPhaseRows, effectiveConfig);
  console.log("Itens de checklist...");
  const checklistItemIdByKey = await importChecklistItems(
    prisma,
    checklistItemRows,
    effectiveConfig,
    categoryIdByKey,
    auditPhaseIdByName
  );
  console.log("Auditorias...");
  const auditIdByTitle = await importAudits(prisma, auditRows, effectiveConfig, workIdByCode, userIdByEmail);
  console.log("Itens de auditoria...");
  await importAuditItems(
    prisma,
    auditItemRows,
    effectiveConfig,
    auditIdByTitle,
    checklistItemIdByKey,
    categoryIdByKey,
    auditPhaseIdByName
  );

  await prisma.$disconnect();
  writeLogFile();
  console.log("Importação concluída. Log salvo em scripts/import-log-*.txt");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
