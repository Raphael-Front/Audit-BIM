/**
 * Importa os itens de verificação da planilha para a biblioteca (tbl_checklist_template).
 *
 * Uso:
 *   node scripts/import-itens-verificacao.mjs <caminho-do-json> [--dry-run]
 *
 * O JSON de entrada é gerado a partir da planilha e tem o formato:
 *   [{ disciplina: "ARQUITETURA", itens: [{ categoria, texto, peso, ordem }] }]
 *
 * É idempotente: identifica o que já existe pela chave
 * (disciplina + categoria + texto do item) e só insere o que falta.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- env ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > -1) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const jsonPath = process.argv[2];
const DRY = process.argv.includes("--dry-run");
if (!jsonPath) {
  console.error("Informe o caminho do JSON. Ex: node scripts/import-itens-verificacao.mjs itens.json");
  process.exit(1);
}

/** Cada bloco da planilha vira uma ou mais disciplinas (por código). */
const MAPA_DISCIPLINAS = {
  ARQUITETURA: ["ARQ"],
  INTERIORES: ["AIT"],
  INSTALAÇÕES: ["CLI", "CPR", "ELE", "ELS", "HGA", "HID", "HIN", "HSP", "IRR", "SDA", "SPDA"],
  "EMT / EST": ["EMT", "EST"],
};

/** Código a partir do nome: sem acentos, maiúsculo, separado por _ e limitado a 50 chars. */
function slugCodigo(nome) {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase()
      .slice(0, 50) || "CATEGORIA"
  );
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  const blocos = JSON.parse(readFileSync(jsonPath, "utf8"));

  // ---------- disciplinas ----------
  const { data: disciplinas, error: eDisc } = await sb.from("dim_disciplinas").select("id, codigo, nome");
  if (eDisc) throw new Error(`disciplinas: ${eDisc.message}`);
  const discPorCodigo = new Map(disciplinas.map((d) => [d.codigo, d]));

  const alvos = []; // { bloco, disciplina }
  for (const bloco of blocos) {
    const codigos = MAPA_DISCIPLINAS[bloco.disciplina];
    if (!codigos) throw new Error(`Bloco sem mapeamento: "${bloco.disciplina}"`);
    for (const cod of codigos) {
      const d = discPorCodigo.get(cod);
      if (!d) throw new Error(`Disciplina não encontrada no banco: ${cod}`);
      alvos.push({ bloco, disciplina: d });
    }
  }

  // ---------- categorias ----------
  const nomesCategoria = [];
  for (const bloco of blocos)
    for (const item of bloco.itens)
      if (!nomesCategoria.includes(item.categoria)) nomesCategoria.push(item.categoria);

  const { data: catsExistentes, error: eCat } = await sb.from("dim_categorias").select("id, codigo, nome");
  if (eCat) throw new Error(`categorias: ${eCat.message}`);
  const catPorNome = new Map(catsExistentes.map((c) => [c.nome.trim().toLowerCase(), c]));

  const catsNovas = [];
  nomesCategoria.forEach((nome, idx) => {
    if (catPorNome.has(nome.trim().toLowerCase())) return;
    catsNovas.push({ codigo: slugCodigo(nome), nome, ordemExibicao: idx, ativo: true });
  });

  console.log(`Categorias: ${nomesCategoria.length} na planilha, ${catsNovas.length} a criar.`);
  if (catsNovas.length) {
    if (DRY) {
      // IDs fictícios só para o dry-run conseguir simular as etapas seguintes
      catsNovas.forEach((c, i) => catPorNome.set(c.nome.trim().toLowerCase(), { ...c, id: `dry-${i}` }));
    } else {
      const { data, error } = await sb.from("dim_categorias").insert(catsNovas).select("id, codigo, nome");
      if (error) throw new Error(`insert categorias: ${error.message}`);
      for (const c of data) catPorNome.set(c.nome.trim().toLowerCase(), c);
    }
  }
  const catId = (nome) => catPorNome.get(nome.trim().toLowerCase())?.id;

  // ---------- vínculos categoria x disciplina ----------
  const { data: linksExist } = await sb.from("dim_categorias_disciplinas").select("categoriaId, disciplinaId");
  const temLink = new Set((linksExist ?? []).map((l) => `${l.categoriaId}|${l.disciplinaId}`));
  const linksNovos = [];
  for (const { bloco, disciplina } of alvos) {
    const nomes = [...new Set(bloco.itens.map((i) => i.categoria))];
    nomes.forEach((nome, idx) => {
      const cid = catId(nome);
      if (!cid) return; // dry-run: categoria ainda não existe
      const k = `${cid}|${disciplina.id}`;
      if (temLink.has(k)) return;
      temLink.add(k);
      linksNovos.push({ categoriaId: cid, disciplinaId: disciplina.id, ordemExibicao: idx });
    });
  }
  console.log(`Vínculos categoria-disciplina a criar: ${linksNovos.length}`);
  if (linksNovos.length && !DRY) {
    for (const part of chunk(linksNovos, 200)) {
      const { error } = await sb.from("dim_categorias_disciplinas").insert(part);
      if (error) throw new Error(`insert vinculos: ${error.message}`);
    }
  }

  // ---------- itens de template ----------
  const discIds = [...new Set(alvos.map((a) => a.disciplina.id))];
  const { data: tplExist, error: eTpl } = await sb
    .from("tbl_checklist_template")
    .select("disciplinaId, categoriaId, itemVerificacao")
    .in("disciplinaId", discIds)
    .limit(10000);
  if (eTpl) throw new Error(`templates existentes: ${eTpl.message}`);
  const chaveTpl = (d, c, t) => `${d}|${c}|${t.trim().toLowerCase()}`;
  const jaTem = new Set((tplExist ?? []).map((t) => chaveTpl(t.disciplinaId, t.categoriaId, t.itemVerificacao)));
  console.log(`Itens de template já existentes nessas disciplinas: ${jaTem.size}`);

  const novos = [];
  for (const { bloco, disciplina } of alvos) {
    for (const item of bloco.itens) {
      const cid = catId(item.categoria);
      if (!cid) continue;
      const k = chaveTpl(disciplina.id, cid, item.texto);
      if (jaTem.has(k)) continue;
      jaTem.add(k); // evita duplicar dentro do próprio lote
      novos.push({
        versao: 1,
        disciplinaId: disciplina.id,
        categoriaId: cid,
        itemVerificacao: item.texto,
        peso: item.peso,
        pontosMaximo: item.peso, // definido pelo usuário: pontos máximos = peso
        origem: "template_original",
        ativo: true,
        ordemExibicao: item.ordem,
      });
    }
  }
  console.log(`Itens de template a inserir: ${novos.length}`);

  if (DRY) {
    console.log("\n--- DRY RUN: nada foi gravado ---");
    const porDisc = {};
    for (const n of novos) {
      const d = disciplinas.find((x) => x.id === n.disciplinaId);
      porDisc[d.codigo] = (porDisc[d.codigo] ?? 0) + 1;
    }
    console.log("por disciplina:", porDisc);
    return;
  }

  const inseridos = [];
  for (const part of chunk(novos, 200)) {
    const { data, error } = await sb.from("tbl_checklist_template").insert(part).select("id");
    if (error) throw new Error(`insert templates: ${error.message}`);
    inseridos.push(...data.map((r) => r.id));
  }
  console.log(`Inseridos ${inseridos.length} itens de template.`);

  // ---------- aplicabilidade por fase ----------
  // Sem vínculo com fase o item não aparece ao criar auditoria; por padrão vale para todas.
  const { data: fases } = await sb.from("dim_fases").select("id, codigo").eq("ativo", true);
  const aplic = [];
  for (const id of inseridos) for (const f of fases ?? []) aplic.push({ templateItemId: id, faseId: f.id, obrigatorio: false });
  for (const part of chunk(aplic, 500)) {
    const { error } = await sb.from("tbl_template_aplicabilidade_fases").insert(part);
    if (error) throw new Error(`insert aplicabilidade: ${error.message}`);
  }
  console.log(`Aplicabilidade criada: ${aplic.length} vínculos (${fases?.length ?? 0} fases por item).`);
  console.log("\nImportação concluída.");
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
