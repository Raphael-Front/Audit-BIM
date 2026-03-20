import { hashSync } from "bcryptjs";
import { PrismaClient, PerfilUsuario, OrigemTemplate } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- DIM_OBRAS (3–5 obras) ---
  const obras = await Promise.all([
    prisma.dimObra.upsert({
      where: { codigo: "OBR-001" },
      create: { codigo: "OBR-001", nome: "Edifício Residencial Alpha", endereco: "Av. Principal, 100", ativo: true },
      update: {},
    }),
    prisma.dimObra.upsert({
      where: { codigo: "OBR-002" },
      create: { codigo: "OBR-002", nome: "Condomínio Comercial Beta", endereco: "Rua das Flores, 200", ativo: true },
      update: {},
    }),
    prisma.dimObra.upsert({
      where: { codigo: "OBR-003" },
      create: { codigo: "OBR-003", nome: "Hospital Municipal", endereco: "Praça da Saúde, s/n", ativo: true },
      update: {},
    }),
    prisma.dimObra.upsert({
      where: { codigo: "OBR-004" },
      create: { codigo: "OBR-004", nome: "Escola Modelo", endereco: "Av. Educação, 50", ativo: true },
      update: {},
    }),
  ]);

  // --- DIM_FASES (EP, PL, LO, AS_BUILT) ---
  const fases = await Promise.all([
    prisma.dimFase.upsert({
      where: { codigo: "EP" },
      create: { codigo: "EP", nome: "Estudo Preliminar", descricao: "Fase de estudo preliminar", ordemSequencial: 1, ativo: true },
      update: {},
    }),
    prisma.dimFase.upsert({
      where: { codigo: "PL" },
      create: { codigo: "PL", nome: "Planejamento", descricao: "Fase de planejamento (LOD 300)", ordemSequencial: 2, ativo: true },
      update: {},
    }),
    prisma.dimFase.upsert({
      where: { codigo: "LO" },
      create: { codigo: "LO", nome: "Locação", descricao: "Fase de locação (LOD 350)", ordemSequencial: 3, ativo: true },
      update: {},
    }),
    prisma.dimFase.upsert({
      where: { codigo: "AS_BUILT" },
      create: { codigo: "AS_BUILT", nome: "As Built", descricao: "Fase as built (conformidade final)", ordemSequencial: 4, ativo: true },
      update: {},
    }),
  ]);

  // --- DIM_DISCIPLINAS (5+) ---
  const disciplinas = await Promise.all([
    prisma.dimDisciplina.upsert({
      where: { codigo: "ARQ" },
      create: { codigo: "ARQ", nome: "Arquitetura", descricao: "Disciplina de arquitetura", ativo: true },
      update: {},
    }),
    prisma.dimDisciplina.upsert({
      where: { codigo: "EST" },
      create: { codigo: "EST", nome: "Estrutura", descricao: "Estruturas", ativo: true },
      update: {},
    }),
    prisma.dimDisciplina.upsert({
      where: { codigo: "HID" },
      create: { codigo: "HID", nome: "Hidráulica", descricao: "Instalações hidráulicas", ativo: true },
      update: {},
    }),
    prisma.dimDisciplina.upsert({
      where: { codigo: "ELE" },
      create: { codigo: "ELE", nome: "Elétrica", descricao: "Instalações elétricas", ativo: true },
      update: {},
    }),
    prisma.dimDisciplina.upsert({
      where: { codigo: "INC" },
      create: { codigo: "INC", nome: "Incêndio", descricao: "SPDA e combate a incêndio", ativo: true },
      update: {},
    }),
  ]);

  const arq = disciplinas[0];
  const est = disciplinas[1];
  const hid = disciplinas[2];
  const ele = disciplinas[3];
  const inc = disciplinas[4];

  // --- DIM_CATEGORIAS (10+) + vínculo com disciplinas ---
  const catArq1 = await prisma.dimCategoria.findFirst({ where: { codigo: "ARQ-GER" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "ARQ-GER", nome: "Arquitetura - Geral", ordemExibicao: 1, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: arq.id, ordemExibicao: 1 } });
      return c;
    })());
  const catArq2 = await prisma.dimCategoria.findFirst({ where: { codigo: "ARQ-PAV" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "ARQ-PAV", nome: "Arquitetura - Pavimentos", ordemExibicao: 2, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: arq.id, ordemExibicao: 2 } });
      return c;
    })());
  const catEst1 = await prisma.dimCategoria.findFirst({ where: { codigo: "EST-LAU" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "EST-LAU", nome: "Estrutura - Lajes", ordemExibicao: 1, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: est.id, ordemExibicao: 1 } });
      return c;
    })());
  const catEst2 = await prisma.dimCategoria.findFirst({ where: { codigo: "EST-PIL" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "EST-PIL", nome: "Estrutura - Pilares", ordemExibicao: 2, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: est.id, ordemExibicao: 2 } });
      return c;
    })());
  const catHid1 = await prisma.dimCategoria.findFirst({ where: { codigo: "HID-AGUA" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "HID-AGUA", nome: "Hidráulica - Água fria", ordemExibicao: 1, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: hid.id, ordemExibicao: 1 } });
      return c;
    })());
  const catHid2 = await prisma.dimCategoria.findFirst({ where: { codigo: "HID-ESG" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "HID-ESG", nome: "Hidráulica - Esgoto", ordemExibicao: 2, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: hid.id, ordemExibicao: 2 } });
      return c;
    })());
  const catEle1 = await prisma.dimCategoria.findFirst({ where: { codigo: "ELE-LUM" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "ELE-LUM", nome: "Elétrica - Iluminação", ordemExibicao: 1, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: ele.id, ordemExibicao: 1 } });
      return c;
    })());
  const catEle2 = await prisma.dimCategoria.findFirst({ where: { codigo: "ELE-DAD" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "ELE-DAD", nome: "Elétrica - Dados", ordemExibicao: 2, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: ele.id, ordemExibicao: 2 } });
      return c;
    })());
  const catInc1 = await prisma.dimCategoria.findFirst({ where: { codigo: "INC-SPDA" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "INC-SPDA", nome: "Incêndio - SPDA", ordemExibicao: 1, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: inc.id, ordemExibicao: 1 } });
      return c;
    })());
  const catInc2 = await prisma.dimCategoria.findFirst({ where: { codigo: "INC-HIDR" } })
    ?? (await (async () => {
      const c = await prisma.dimCategoria.create({ data: { codigo: "INC-HIDR", nome: "Incêndio - Hidrantes", ordemExibicao: 2, ativo: true } });
      await prisma.dimCategoriaDisciplina.create({ data: { categoriaId: c.id, disciplinaId: inc.id, ordemExibicao: 2 } });
      return c;
    })());

  const categorias = [catArq1, catArq2, catEst1, catEst2, catHid1, catHid2, catEle1, catEle2, catInc1, catInc2];

  // --- DIM_USUARIOS (admin + auditor) ---
  const senhaAdmin = hashSync("admin123", 10);
  const senhaAuditor = hashSync("auditor123", 10);
  const admin = await prisma.dimUsuario.upsert({
    where: { email: "admin@bim.local" },
    create: {
      email: "admin@bim.local",
      nomeCompleto: "Administrador BIM",
      senhaHash: senhaAdmin,
      perfil: PerfilUsuario.admin_bim,
      ativo: true,
    },
    update: { nomeCompleto: "Administrador BIM", senhaHash: senhaAdmin, perfil: PerfilUsuario.admin_bim, ativo: true },
  });
  const auditor = await prisma.dimUsuario.upsert({
    where: { email: "auditor@bim.local" },
    create: {
      email: "auditor@bim.local",
      nomeCompleto: "Auditor BIM",
      senhaHash: senhaAuditor,
      perfil: PerfilUsuario.auditor_bim,
      ativo: true,
    },
    update: { nomeCompleto: "Auditor BIM", senhaHash: senhaAuditor, perfil: PerfilUsuario.auditor_bim, ativo: true },
  });

  // --- TBL_CHECKLIST_TEMPLATE (30+ itens) ---
  const itensDescricoes = [
    { disc: arq, cat: catArq1, text: "Verificar compatibilidade de cotas entre arquitetura e estrutura", peso: 3, ordem: 1 },
    { disc: arq, cat: catArq1, text: "Conferir níveis de piso acabado em todos os pavimentos", peso: 2, ordem: 2 },
    { disc: arq, cat: catArq1, text: "Validar representação de esquadrias e vãos", peso: 2, ordem: 3 },
    { disc: arq, cat: catArq2, text: "Verificar compatibilidade de grelhas com estrutura", peso: 3, ordem: 4 },
    { disc: arq, cat: catArq2, text: "Conferir cotas de pé-direito e forro", peso: 2, ordem: 5 },
    { disc: est, cat: catEst1, text: "Verificar armadura de lajes conforme projeto estrutural", peso: 5, ordem: 6 },
    { disc: est, cat: catEst1, text: "Conferir espessura e cobrimento de lajes", peso: 4, ordem: 7 },
    { disc: est, cat: catEst1, text: "Validar aberturas e recortes em lajes", peso: 3, ordem: 8 },
    { disc: est, cat: catEst2, text: "Verificar posicionamento de pilares em planta", peso: 5, ordem: 9 },
    { disc: est, cat: catEst2, text: "Conferir dimensões e armadura de pilares", peso: 5, ordem: 10 },
    { disc: est, cat: catEst2, text: "Validar encontros de vigas e pilares", peso: 4, ordem: 11 },
    { disc: hid, cat: catHid1, text: "Verificar trajetos de tubulação de água fria", peso: 3, ordem: 12 },
    { disc: hid, cat: catHid1, text: "Conferir pontos de consumo e reservatório", peso: 2, ordem: 13 },
    { disc: hid, cat: catHid2, text: "Verificar trajetos de esgoto e ventilação", peso: 4, ordem: 14 },
    { disc: hid, cat: catHid2, text: "Conferir caixas de inspeção e passagens", peso: 3, ordem: 15 },
    { disc: ele, cat: catEle1, text: "Verificar circuitos de iluminação e pontos", peso: 2, ordem: 16 },
    { disc: ele, cat: catEle1, text: "Conferir compatibilidade com forro e lajes", peso: 3, ordem: 17 },
    { disc: ele, cat: catEle2, text: "Verificar trajetos de dados e telecomunicações", peso: 2, ordem: 18 },
    { disc: ele, cat: catEle2, text: "Conferir posição de racks e passagens", peso: 2, ordem: 19 },
    { disc: inc, cat: catInc1, text: "Verificar malha de SPDA e descidas", peso: 5, ordem: 20 },
    { disc: inc, cat: catInc1, text: "Conferir pontos de conexão e equipotencialização", peso: 4, ordem: 21 },
    { disc: inc, cat: catInc2, text: "Verificar rede de hidrantes e mangotinhos", peso: 5, ordem: 22 },
    { disc: inc, cat: catInc2, text: "Conferir abrigos e acessibilidade", peso: 3, ordem: 23 },
    { disc: arq, cat: catArq1, text: "Validar acessibilidade e rotas de fuga", peso: 4, ordem: 24 },
    { disc: arq, cat: catArq2, text: "Conferir compartimentação e resistência ao fogo", peso: 5, ordem: 25 },
    { disc: est, cat: catEst1, text: "Verificar detalhes de bordas e cantos de laje", peso: 3, ordem: 26 },
    { disc: hid, cat: catHid1, text: "Validar reservação e pressões", peso: 3, ordem: 27 },
    { disc: ele, cat: catEle1, text: "Verificar quadro de distribuição e circuitos", peso: 4, ordem: 28 },
    { disc: inc, cat: catInc1, text: "Conferir sistema de detecção de fumaça", peso: 4, ordem: 29 },
    { disc: inc, cat: catInc2, text: "Validar sinalização de emergência", peso: 2, ordem: 30 },
    { disc: arq, cat: catArq1, text: "Verificar legendas e nomenclatura em plantas", peso: 1, ordem: 31 },
    { disc: est, cat: catEst2, text: "Conferir fundações e blocos", peso: 5, ordem: 32 },
  ];

  const ep = fases[0];
  const pl = fases[1];
  const lo = fases[2];
  const asBuilt = fases[3];

  const existingTemplates = await prisma.tblChecklistTemplate.count();
  if (existingTemplates >= 30) {
    console.log("Templates já existem (>= 30). Pulando criação de itens de template.");
  } else {
    for (const item of itensDescricoes) {
      const template = await prisma.tblChecklistTemplate.create({
        data: {
          versao: 1,
          disciplinaId: item.disc.id,
          categoriaId: item.cat.id,
          itemVerificacao: item.text,
          peso: item.peso,
          pontosMaximo: 10,
          origem: OrigemTemplate.template_original,
          ativo: true,
          ordemExibicao: item.ordem,
        },
      });
      const fasesParaItem = item.peso >= 4 ? [ep, pl, lo, asBuilt] : [pl, lo];
      for (const fase of fasesParaItem) {
        await prisma.tblTemplateAplicabilidadeFase.upsert({
          where: {
            templateItemId_faseId: { templateItemId: template.id, faseId: fase.id },
          },
          create: {
            templateItemId: template.id,
            faseId: fase.id,
            obrigatorio: item.peso >= 4,
          },
          update: {},
        });
      }
    }
  }

  console.log("Seed concluído: obras, fases, disciplinas, categorias, usuários (admin + auditor), 32 itens de template e aplicabilidade.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
