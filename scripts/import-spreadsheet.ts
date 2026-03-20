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
import { join, dirname, resolve } from "path";
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
  // headerRowIndex 1 = primeira linha = cabeçalhos (padrão). Evitar range que pode falhar em algumas planilhas.
  if (options?.headerRowIndex != null && options.headerRowIndex > 1) {
    opts.range = options.headerRowIndex - 1; // SheetJS: 0-based, pula linhas acima
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, opts);
}

/** Encontra a chave real na linha que corresponde ao cabeçalho configurado (permite espaços/encoding). */
function resolveColumnKey(row: Record<string, unknown>, configHeader: string): string | null {
  const want = String(configHeader).trim().toLowerCase();
  for (const key of Object.keys(row)) {
    if (String(key).trim().toLowerCase() === want) return key;
  }
  return configHeader; // fallback: usar exatamente o config
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
function findSheet(wb: XLSX.WorkBook, preferred: string | undefined): string {
  if (!preferred) return wb.SheetNames[0];
  if (wb.SheetNames.includes(preferred)) return preferred;
  const lower = preferred.toLowerCase();
  const found = wb.SheetNames.find((s) => s.toLowerCase() === lower);
  if (found) return found;
  return wb.SheetNames[0];
}

function readAndNormalizeSingleSheet(
  wb: XLSX.WorkBook,
  singleSheet: SingleSheetConfig
): NormalizedSingleRow[] {
  const sheetName = findSheet(wb, singleSheet.sheetName || wb.SheetNames[0]);
  const rawRows = getSheetRows(wb, sheetName, {
    headerRowIndex: singleSheet.headerRowIndex ?? 1,
  });
  const c = singleSheet.columns;

  // Resolver chaves reais (planilha pode ter espaços/encoding diferentes do config)
  const firstRow = rawRows[0] ?? {};
  const key = (k: keyof SingleSheetColumns) => resolveColumnKey(firstRow, c[k]) ?? c[k];

  let lastObra = "";
  let lastFase = "";
  let lastDisciplina = "";

  const normalized = rawRows
    .map((row) => {
      const obraRaw = String((row[key("obra")] ?? "").toString()).trim();
      const faseRaw = String((row[key("fase")] ?? "").toString()).trim();
      const disciplinaRaw = String((row[key("disciplina")] ?? "").toString()).trim();

      // Propagar valores vazios: usar o último conhecido (regra: mudança = nova auditoria)
      const obra = obraRaw !== "" ? (lastObra = obraRaw) : lastObra;
      const fase = faseRaw !== "" ? (lastFase = faseRaw) : lastFase;
      const disciplina = disciplinaRaw !== "" ? (lastDisciplina = disciplinaRaw) : lastDisciplina;

      const categoria = String((row[key("categoria")] ?? "").toString()).trim();
      const itensVerificacao = String((row[key("itensVerificacao")] ?? "").toString()).trim();
      const status = String((row[key("status")] ?? "").toString()).trim();
      const evidenciaObservacao = String((row[key("evidenciaObservacao")] ?? "").toString()).trim();
      const cf = String((row[key("cf")] ?? "").toString()).trim();
      const proximaRevisao = parseDate(row[key("proximaRevisao")]);
      const peso = row[key("peso")] != null && row[key("peso")] !== "" ? Number(row[key("peso")]) : 1;
      const pontos = row[key("pontos")] != null && row[key("pontos")] !== "" ? Number(row[key("pontos")]) : null;
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
    return { key: k, title: `${o}-${d}-${f}` };
  });
  const auditRows: Record<string, unknown>[] = auditTitles.map(({ key, title }) => {
    const [o, f, d] = key.split("\t");
    return {
    workCode: o,
    phaseName: defaultPhase,
    disciplineName: d,
    auditPhaseName: f,
    title,
    startDate: new Date(),
    status: "IN_PROGRESS",
    auditorEmail: singleSheet.defaultAuditorEmail ?? "",
    createdByEmail: singleSheet.defaultAuditorEmail ?? "",
  };
  });
  const auditItemRows: Record<string, unknown>[] = normalized.map((r) => ({
    auditTitle: `${r.obra}-${r.disciplina}-${r.fase}`,
    disciplineName: r.disciplina,
    categoryName: r.categoria,
    auditPhaseName: r.fase,
    description: r.itensVerificacao,
    status: r.status,
    evidenceText: r.evidenciaObservacao || undefined,
    construflowRef: r.cf || undefined,
    nextReviewAt: r.proximaRevisao ?? undefined,
    pointsObtained: r.pontos ?? undefined,
    peso: r.peso ?? 3,
    maxPoints: 10,
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
        peso: "peso",
        maxPoints: "maxPoints",
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

const STATUS_MAP: Record<string, "em_andamento" | "aguardando_apontamentos" | "concluida" | "cancelada" | "nao_iniciado"> = {
  em_andamento: "em_andamento",
  "em andamento": "em_andamento",
  aguardando: "aguardando_apontamentos",
  aguardando_apontamentos: "aguardando_apontamentos",
  concluida: "concluida",
  concluída: "concluida",
  cancelada: "cancelada",
  nao_iniciado: "nao_iniciado",
};

const ITEM_STATUS_MAP: Record<string, "nao_iniciado" | "conforme" | "nao_conforme" | "nao_aplicavel" | "corrigido"> = {
  pendente: "nao_iniciado",
  conforme: "conforme",
  nao_conforme: "nao_conforme",
  "não conforme": "nao_conforme",
  observacao: "nao_iniciado",
  na: "nao_aplicavel",
  "n/a": "nao_aplicavel",
  corrigido: "corrigido",
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
      const existing = await prisma.dimUsuario.findUnique({ where: { email } });
      if (existing) {
        map.set(email, existing.id);
        continue;
      }
    }
    const roleRaw = String((raw.role ?? raw["Perfil"] ?? "AUDITOR").toString()).toLowerCase();
    const perfil = (ROLE_MAP[roleRaw] ?? "AUDITOR") === "ADMIN" ? "admin_bim" : (ROLE_MAP[roleRaw] ?? "AUDITOR") === "READER" ? "leitor" : "auditor_bim";
    const senhaHash = passwordRaw ? await bcrypt.hash(String(passwordRaw), SALT_ROUNDS) : await bcrypt.hash("Trocar@123", SALT_ROUNDS);
    try {
      const user = await prisma.dimUsuario.create({ data: { nomeCompleto: name, email, senhaHash, perfil } });
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

/** Obra (DimObra): sempre pula se já existir. */
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
    const code = (raw.code ?? raw["Código"] ? String(raw.code ?? raw["Código"]).trim() : null) || name;
    const existing = await prisma.dimObra.findFirst({
      where: { OR: [{ codigo: code }, { nome: name }], deletedAt: null },
    });
    if (existing) {
      map.set(code, existing.id);
      map.set(name, existing.id);
      continue;
    }
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      const work = await prisma.dimObra.create({ data: { codigo: code, nome: name, ativo: active } });
      map.set(code, work.id);
      map.set(name, work.id);
      inserted++;
    } catch (e) {
      const err = e as { code?: string };
      if (err?.code === "P2002") {
        const found = await prisma.dimObra.findFirst({ where: { OR: [{ codigo: code }, { nome: name }], deletedAt: null } });
        if (found) {
          map.set(code, found.id);
          map.set(name, found.id);
          continue;
        }
      }
      log(`Linha ${i + 2}: ${(e as Error).message}`, "Work", i + 2);
      errors++;
    }
  }
  log(`Obras: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

/** Phase: DimFase é global (não por obra). Cria fases únicas. */
async function importPhases(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig, _workIdByCode: Map<string, string>): Promise<void> {
  const sheetConfig = config.sheets?.Phase;
  if (!sheetConfig || rows.length === 0) return;
  const cols = sheetConfig.columns;
  const seen = new Set<string>();
  let inserted = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const existing = await prisma.dimFase.findFirst({ where: { OR: [{ codigo: name }, { nome: name }] } });
    if (existing) continue;
    try {
      await prisma.dimFase.create({
        data: { codigo: name.slice(0, 20), nome: name, ordemSequencial: 0, ativo: true },
      });
      inserted++;
    } catch {
      /* ignora duplicata */
    }
  }
  if (inserted > 0) log(`Fases: ${inserted} inseridos.`);
}

/** Disciplina (DimDisciplina): sempre pula se já existir. */
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
    const code = name.slice(0, 20);
    const existing = await prisma.dimDisciplina.findFirst({ where: { OR: [{ codigo: code }, { nome: name }] } });
    if (existing) {
      map.set(name, existing.id);
      continue;
    }
    const active = raw.active ?? raw["Ativo"] !== undefined ? Boolean(Number(raw.active ?? raw["Ativo"]) ?? raw.active === "sim") : true;
    try {
      const d = await prisma.dimDisciplina.create({ data: { codigo: code, nome: name, ativo: active } });
      map.set(name, d.id);
      inserted++;
    } catch (e) {
      const err = e as { code?: string };
      if (err?.code === "P2002") {
        const found = await prisma.dimDisciplina.findFirst({ where: { OR: [{ codigo: code }, { nome: name }] } });
        if (found) {
          map.set(name, found.id);
          continue;
        }
      }
      log(`Linha ${i + 2}: ${(e as Error).message}`, "Discipline", i + 2);
      errors++;
    }
  }
  log(`Disciplinas: ${inserted} inseridos, ${errors} erros.`);
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
    const codigo = `${disciplineName}-${name}`.replace(/\s+/g, "-").slice(0, 50);
    let cat = await prisma.dimCategoria.findFirst({ where: { codigo } });
    if (!cat) {
      try {
        cat = await prisma.dimCategoria.create({ data: { codigo, nome: name, ordemExibicao: order, ativo: active } });
        await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: cat.id, disciplinaId: disciplineId, ordemExibicao: order } });
        inserted++;
      } catch (e) {
        const err = e as { code?: string };
        if (err?.code === "P2002") {
          cat = await prisma.dimCategoria.findFirst({ where: { codigo } });
          if (cat) {
            const link = await prisma.dimCategoriaDisciplina.findUnique({
              where: { categoriaId_disciplinaId: { categoriaId: cat.id, disciplinaId: disciplineId } },
            });
            if (!link) {
              await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: cat.id, disciplinaId: disciplineId, ordemExibicao: order } });
            }
            map.set(`${disciplineName}::${name}`, cat.id);
            continue;
          }
        }
        log(`Linha ${i + 2}: ${(e as Error).message}`, "Category", i + 2);
        errors++;
        continue;
      }
    } else {
      const link = await prisma.dimCategoriaDisciplina.findUnique({
        where: { categoriaId_disciplinaId: { categoriaId: cat.id, disciplinaId: disciplineId } },
      });
      if (!link) {
        await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: cat.id, disciplinaId: disciplineId, ordemExibicao: order } });
      }
    }
    map.set(`${disciplineName}::${name}`, cat.id);
  }
  log(`Categorias: ${inserted} inseridos, ${errors} erros.`);
  return map;
}

/** Fase Auditoria → DimFase (LO, PR, Geral, etc.) */
async function importAuditPhases(prisma: PrismaClient, rows: Record<string, unknown>[], config: ImportConfig): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.AuditPhase;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const name = String((raw.name ?? raw["Nome"] ?? "").toString()).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    let f = await prisma.dimFase.findFirst({ where: { OR: [{ codigo: name }, { nome: name }] } });
    if (!f) {
      try {
        f = await prisma.dimFase.create({
          data: { codigo: name.slice(0, 20), nome: name, ordemSequencial: 0, ativo: true },
        });
      } catch {
        f = await prisma.dimFase.findFirst({ where: { OR: [{ codigo: name }, { nome: name }] } });
      }
    }
    if (f) map.set(name, f.id);
  }
  return map;
}

async function importChecklistItems(
  prisma: PrismaClient,
  rows: Record<string, unknown>[],
  config: ImportConfig,
  categoryIdByKey: Map<string, string>,
  auditPhaseIdByName: Map<string, string>,
  disciplineIdByName: Map<string, string>
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
    const disciplinaId = categoryKey ? disciplineIdByName.get(disciplineName) : null;
    if (!disciplinaId) {
      log(`Linha ${i + 2}: disciplina não encontrada`, "ChecklistItem", i + 2);
      errors++;
      continue;
    }
    const existingItem = await prisma.tblChecklistTemplate.findFirst({
      where: {
        disciplinaId,
        categoriaId: categoryId,
        itemVerificacao: description,
        aplicabilidadeFases: { some: { faseId: auditPhaseId } },
      },
    });
    if (existingItem) {
      const key = code ? `${auditPhaseId}:${categoryId}:${code}` : `${auditPhaseId}:${categoryId}:${description.slice(0, 50)}`;
      map.set(key, existingItem.id);
      continue;
    }
    try {
      const item = await prisma.tblChecklistTemplate.create({
        data: {
          disciplinaId,
          categoriaId: categoryId,
          itemVerificacao: description,
          peso: weight,
          pontosMaximo: maxPoints,
          ativo: active,
        },
      });
      const faseId = auditPhaseId;
      await prisma.tblTemplateAplicabilidadeFase.upsert({
        where: { templateItemId_faseId: { templateItemId: item.id, faseId } },
        create: { templateItemId: item.id, faseId, obrigatorio: false },
        update: {},
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

function genCodigoAuditoria(): string {
  return `AUD-IMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function importAudits(
  prisma: PrismaClient,
  rows: Record<string, unknown>[],
  config: ImportConfig,
  workIdByCode: Map<string, string>,
  userIdByEmail: Map<string, string>,
  disciplineIdByName?: Map<string, string>,
  faseIdByNameParam?: Map<string, string>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sheetConfig = config.sheets?.Audit;
  if (!sheetConfig || rows.length === 0) return map;
  const cols = sheetConfig.columns;
  const disciplineIdByNameResolved =
    disciplineIdByName ?? new Map((await prisma.dimDisciplina.findMany({ select: { id: true, nome: true } })).map((d) => [d.nome, d.id]));
  let faseIdByName: Map<string, string>;
  if (faseIdByNameParam) {
    faseIdByName = faseIdByNameParam;
  } else {
    const fases = await prisma.dimFase.findMany({ select: { id: true, codigo: true, nome: true } });
    faseIdByName = new Map<string, string>();
    for (const f of fases) {
      faseIdByName.set(f.nome, f.id);
      faseIdByName.set(f.codigo, f.id);
    }
  }
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const raw = mapRow(rows[i], cols);
    const workCode = String((raw.workCode ?? raw["Obra Código"] ?? "").toString()).trim();
    const auditPhaseName = String((raw.auditPhaseName ?? raw["Fase Auditoria"] ?? "").toString()).trim();
    const disciplineName = String((raw.disciplineName ?? raw["Disciplina"] ?? "").toString()).trim();
    const title = String((raw.title ?? raw["Título"] ?? `Auditoria ${i + 1}`).toString()).trim();
    const startDate = parseDate(raw.startDate ?? raw["Data Início"]) ?? new Date();
    const auditorEmail = String((raw.auditorEmail ?? raw["Auditor Email"] ?? "").toString()).trim().toLowerCase();
    const obraId = workIdByCode.get(workCode);
    if (!obraId) {
      log(`Linha ${i + 2}: obra "${workCode}" não encontrada`, "Audit", i + 2);
      errors++;
      continue;
    }
    const faseId = auditPhaseName ? faseIdByName.get(auditPhaseName) ?? null : null;
    const disciplineId = disciplineName ? disciplineIdByNameResolved.get(disciplineName) : null;
    if (!disciplineId || !faseId) {
      log(`Linha ${i + 2}: disciplina ou fase não encontrados (disciplina="${disciplineName}", fase="${auditPhaseName}")`, "Audit", i + 2);
      errors++;
      continue;
    }
    const auditorId = auditorEmail ? userIdByEmail.get(auditorEmail) : null;
    if (!auditorId) {
      log(`Linha ${i + 2}: auditor não encontrado`, "Audit", i + 2);
      errors++;
      continue;
    }
    const statusRaw = String((raw.status ?? raw["Status"] ?? "em_andamento").toString()).toLowerCase().replace(/\s/g, "_");
    const status = STATUS_MAP[statusRaw] ?? "em_andamento";
    const endDate = parseDate(raw.endDate ?? raw["Data Fim"]);
    const revisao = 1;
    const existing = await prisma.fatoAuditoria.findFirst({
      where: { obraId, disciplinaId: disciplineId, faseId, revisao },
    });
    if (existing) {
      map.set(title, existing.id);
      continue;
    }
    try {
      const audit = await prisma.fatoAuditoria.create({
        data: {
          codigoAuditoria: genCodigoAuditoria(),
          obraId,
          disciplinaId: disciplineId,
          faseId,
          revisao,
          titulo: title,
          dataInicio: startDate,
          dataFimPrevista: endDate ?? undefined,
          status,
          auditorResponsavelId: auditorId,
        },
      });
      map.set(title, audit.id);
      inserted++;
    } catch (e) {
      const err = e as { code?: string };
      if (err?.code === "P2002") {
        const found = await prisma.fatoAuditoria.findFirst({ where: { obraId, disciplinaId: disciplineId, faseId, revisao } });
        if (found) {
          map.set(title, found.id);
          continue;
        }
      }
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
  auditPhaseIdByName: Map<string, string>,
  disciplineIdByName: Map<string, string>
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
    let templateItemId: string | null = null;
    const code = raw.checklistItemCode ?? raw["Item Código"];
    const categoryName = String((raw.categoryName ?? raw["Categoria"] ?? "").toString()).trim();
    const disciplineName = String((raw.disciplineName ?? raw["Disciplina"] ?? "").toString()).trim();
    const auditPhaseName = String((raw.auditPhaseName ?? raw["Fase Auditoria"] ?? "").toString()).trim();
    const description = raw.description ?? raw["Descrição"] ? String(raw.description ?? raw["Descrição"]).trim() : "";
    if (!description) {
      log(`Linha ${i + 2}: descrição obrigatória`, "AuditItem", i + 2);
      errors++;
      continue;
    }
    const categoryKey = disciplineName && categoryName ? `${disciplineName}::${categoryName}` : null;
    const categoryId = categoryKey ? categoryIdByKey.get(categoryKey) : null;
    const disciplinaId = disciplineName ? disciplineIdByName.get(disciplineName) : null;
    if (!categoryId || !disciplinaId) {
      log(`Linha ${i + 2}: categoria ou disciplina não encontrados`, "AuditItem", i + 2);
      errors++;
      continue;
    }
    const auditPhaseId = auditPhaseName ? auditPhaseIdByName.get(auditPhaseName) : null;
    if (auditPhaseId) {
      if (code) {
        const key = `${auditPhaseId}:${categoryId}:${String(code).trim()}`;
        templateItemId = checklistItemIdByKey.get(key) ?? null;
      }
      if (!templateItemId) {
        const descKey = `${auditPhaseId}:${categoryId}:${description.slice(0, 50)}`;
        templateItemId = checklistItemIdByKey.get(descKey) ?? null;
      }
    }
    const statusRaw = String((raw.status ?? raw["Status"] ?? "nao_iniciado").toString()).toLowerCase().replace(/\s/g, "_");
    const status = ITEM_STATUS_MAP[statusRaw] ?? "nao_iniciado";
    const evidenciaObservacao = raw.evidenceText ?? raw["Evidência"] ? String(raw.evidenceText ?? raw["Evidência"]).trim() : null;
    const codigoConstruflow = raw.construflowRef ?? raw["Construflow Ref"] ? String(raw.construflowRef ?? raw["Construflow Ref"]).trim() : null;
    const proximaRevisao = parseDate(raw.nextReviewAt ?? raw["Proxima revisão"] ?? raw["Próxima revisão"]);
    const pointsObtained = raw.pointsObtained ?? raw["Pontos"] != null ? Number(raw.pointsObtained ?? raw["Pontos"]) : null;
    const pesoVal = raw.peso ?? raw["Peso"];
    const peso = pesoVal != null ? (Number(pesoVal) || 3) : 3;
    const pontosMaxVal = raw.maxPoints ?? raw["Pontos Máx"];
    const pontosMaximo = pontosMaxVal != null ? (Number(pontosMaxVal) || 3) : 3;
    try {
      await prisma.fatoAuditoriaItem.create({
        data: {
          auditoriaId: auditId,
          templateItemId: templateItemId ?? undefined,
          categoriaId: categoryId,
          disciplinaId,
          itemVerificacaoSnapshot: description,
          pesoSnapshot: peso,
          pontosMaximoSnapshot: pontosMaximo,
          tipoItem: templateItemId ? "template" : "personalizado",
          status,
          evidenciaObservacao: evidenciaObservacao ?? undefined,
          codigoConstruflow: codigoConstruflow ?? undefined,
          proximaRevisao: proximaRevisao ?? undefined,
          pontosObtidos: pointsObtained != null && !Number.isNaN(pointsObtained) ? pointsObtained : 0,
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
  let filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npm run import -- <caminho-da-planilha.xlsx>");
    process.exit(1);
  }
  // Resolver caminho relativo: tenta cwd, depois raiz do projeto
  if (!existsSync(filePath)) {
    const fromRoot = resolve(rootDir, filePath);
    if (existsSync(fromRoot)) filePath = fromRoot;
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
    const user = await prisma.dimUsuario.findUnique({ where: { email } });
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
    auditPhaseIdByName,
    disciplineIdByName
  );
  console.log("Auditorias...");
  const auditIdByTitle = await importAudits(
    prisma,
    auditRows,
    effectiveConfig,
    workIdByCode,
    userIdByEmail,
    disciplineIdByName,
    auditPhaseIdByName
  );
  console.log("Itens de auditoria...");
  await importAuditItems(
    prisma,
    auditItemRows,
    effectiveConfig,
    auditIdByTitle,
    checklistItemIdByKey,
    categoryIdByKey,
    auditPhaseIdByName,
    disciplineIdByName
  );

  await prisma.$disconnect();
  writeLogFile();
  console.log("");
  console.log("Importação concluída. Log salvo em scripts/import-log-*.txt");
  if (auditItemRows.length > 50) {
    console.log("Dica: em planilhas grandes, o resumo por etapa acima indica quantos registros foram inseridos ou reutilizados.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
