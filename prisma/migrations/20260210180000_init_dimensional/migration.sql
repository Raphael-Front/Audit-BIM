-- CreateEnum
CREATE TYPE "perfil_usuario" AS ENUM ('admin_bim', 'auditor_bim', 'leitor');
CREATE TYPE "origem_template" AS ENUM ('template_original', 'promovido_de_auditoria');
CREATE TYPE "status_auditoria" AS ENUM ('nao_iniciado', 'em_andamento', 'aguardando_apontamentos', 'concluida', 'cancelada', 'pausada');
CREATE TYPE "tipo_item_auditoria" AS ENUM ('template', 'personalizado', 'promovido');
CREATE TYPE "status_item_auditoria" AS ENUM ('nao_iniciado', 'conforme', 'nao_conforme', 'nao_aplicavel', 'corrigido');
CREATE TYPE "acao_historico" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'FINALIZAR_VERIFICACAO', 'ADICIONAR_ITEM_PERSONALIZADO', 'CONCLUIR_AUDITORIA', 'CANCELAR_AUDITORIA', 'PAUSAR', 'RETOMAR');
CREATE TYPE "tipo_relatorio" AS ENUM ('parcial', 'tecnico_standby', 'final');
CREATE TYPE "formato_relatorio" AS ENUM ('pdf', 'xlsx');

-- CreateTable dim_obras
CREATE TABLE "dim_obras" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "dim_obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable dim_fases
CREATE TABLE "dim_fases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "ordemSequencial" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dim_fases_pkey" PRIMARY KEY ("id")
);

-- CreateTable dim_disciplinas
CREATE TABLE "dim_disciplinas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dim_disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable dim_categorias
CREATE TABLE "dim_categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "disciplinaId" UUID,
    "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dim_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable dim_usuarios
CREATE TABLE "dim_usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "nomeCompleto" VARCHAR(200) NOT NULL,
    "senhaHash" VARCHAR(255) NOT NULL,
    "perfil" "perfil_usuario" NOT NULL DEFAULT 'auditor_bim',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcesso" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dim_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_checklist_template
CREATE TABLE "tbl_checklist_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "disciplinaId" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "itemVerificacao" TEXT NOT NULL,
    "peso" INTEGER NOT NULL,
    "pontosMaximo" DECIMAL(5,2) NOT NULL,
    "origem" "origem_template" NOT NULL DEFAULT 'template_original',
    "auditoriaOrigemId" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inativadoEm" TIMESTAMPTZ,
    "inativadoPorId" UUID,

    CONSTRAINT "tbl_checklist_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_template_aplicabilidade_fases
CREATE TABLE "tbl_template_aplicabilidade_fases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateItemId" UUID NOT NULL,
    "faseId" UUID NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_template_aplicabilidade_fases_pkey" PRIMARY KEY ("id")
);

-- CreateTable fato_auditorias
CREATE TABLE "fato_auditorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigoAuditoria" VARCHAR(100) NOT NULL,
    "obraId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "faseId" UUID NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "titulo" VARCHAR(255),
    "auditorResponsavelId" UUID NOT NULL,
    "status" "status_auditoria" NOT NULL DEFAULT 'nao_iniciado',
    "dataInicio" DATE NOT NULL,
    "dataFimPrevista" DATE,
    "dataFinalizacaoReal" DATE,
    "dataEntradaStandby" TIMESTAMPTZ,
    "dataConclusao" TIMESTAMPTZ,
    "tempoTotalPausa" TEXT,
    "motivoCancelamento" TEXT,
    "canceladoPorId" UUID,
    "canceladoEm" TIMESTAMPTZ,
    "observacoesGerais" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fato_auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable fato_auditoria_itens
CREATE TABLE "fato_auditoria_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditoriaId" UUID NOT NULL,
    "templateItemId" UUID,
    "categoriaId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "itemVerificacaoSnapshot" TEXT NOT NULL,
    "pesoSnapshot" INTEGER NOT NULL,
    "pontosMaximoSnapshot" DECIMAL(5,2) NOT NULL,
    "tipoItem" "tipo_item_auditoria" NOT NULL DEFAULT 'template',
    "status" "status_item_auditoria" NOT NULL DEFAULT 'nao_iniciado',
    "evidenciaObservacao" TEXT,
    "codigoConstruflow" VARCHAR(100),
    "proximaRevisao" DATE,
    "pontosObtidos" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avaliadoEm" TIMESTAMPTZ,
    "avaliadoPorId" UUID,
    "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fato_auditoria_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_evidencias_anexos
CREATE TABLE "tbl_evidencias_anexos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditoriaItemId" UUID NOT NULL,
    "arquivoNome" VARCHAR(255) NOT NULL,
    "arquivoUrl" TEXT NOT NULL,
    "arquivoTipo" VARCHAR(50) NOT NULL,
    "arquivoTamanhoBytes" BIGINT NOT NULL,
    "descricao" TEXT,
    "uploadedPorId" UUID NOT NULL,
    "uploadedEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_evidencias_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_itens_personalizados_salvos
CREATE TABLE "tbl_itens_personalizados_salvos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditoriaItemId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "itemVerificacao" TEXT NOT NULL,
    "peso" INTEGER NOT NULL,
    "pontosMaximo" DECIMAL(5,2) NOT NULL,
    "criadoPorId" UUID NOT NULL,
    "aprovado" BOOLEAN NOT NULL DEFAULT false,
    "aprovadoPorId" UUID,
    "aprovadoEm" TIMESTAMPTZ,
    "promovidoTemplateId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_itens_personalizados_salvos_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_historico_alteracoes
CREATE TABLE "tbl_historico_alteracoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tabelaNome" VARCHAR(100) NOT NULL,
    "registroId" UUID NOT NULL,
    "campoNome" VARCHAR(100) NOT NULL,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "acao" "acao_historico" NOT NULL,
    "usuarioId" UUID NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_historico_alteracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_scores_calculados
CREATE TABLE "tbl_scores_calculados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditoriaId" UUID NOT NULL,
    "scoreGeral" DECIMAL(5,2) NOT NULL,
    "totalItens" INTEGER NOT NULL,
    "totalAplicavel" INTEGER NOT NULL,
    "totalConforme" INTEGER NOT NULL,
    "totalNaoConforme" INTEGER NOT NULL,
    "totalNa" INTEGER NOT NULL,
    "pontosObtidos" DECIMAL(10,2) NOT NULL,
    "pontosPossiveis" DECIMAL(10,2) NOT NULL,
    "ultimaAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_scores_calculados_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_scores_por_disciplina
CREATE TABLE "tbl_scores_por_disciplina" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditoriaId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "scoreDisciplina" DECIMAL(5,2) NOT NULL,
    "totalItens" INTEGER NOT NULL,
    "totalAplicavel" INTEGER NOT NULL,
    "totalConforme" INTEGER NOT NULL,
    "totalNaoConforme" INTEGER NOT NULL,
    "totalNa" INTEGER NOT NULL,
    "pontosObtidos" DECIMAL(10,2) NOT NULL,
    "pontosPossiveis" DECIMAL(10,2) NOT NULL,
    "ultimaAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_scores_por_disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_scores_por_categoria
CREATE TABLE "tbl_scores_por_categoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditoriaId" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "scoreCategoria" DECIMAL(5,2) NOT NULL,
    "totalItens" INTEGER NOT NULL,
    "totalAplicavel" INTEGER NOT NULL,
    "totalConforme" INTEGER NOT NULL,
    "totalNaoConforme" INTEGER NOT NULL,
    "totalNa" INTEGER NOT NULL,
    "pontosObtidos" DECIMAL(10,2) NOT NULL,
    "pontosPossiveis" DECIMAL(10,2) NOT NULL,
    "ultimaAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_scores_por_categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable tbl_relatorios_gerados
CREATE TABLE "tbl_relatorios_gerados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auditoriaId" UUID NOT NULL,
    "tipoRelatorio" "tipo_relatorio" NOT NULL,
    "formato" "formato_relatorio" NOT NULL,
    "arquivoUrl" TEXT,
    "snapshotData" JSONB,
    "geradoPorId" UUID NOT NULL,
    "geradoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_relatorios_gerados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dim_obras_codigo_key" ON "dim_obras"("codigo");
CREATE UNIQUE INDEX "dim_fases_codigo_key" ON "dim_fases"("codigo");
CREATE UNIQUE INDEX "dim_disciplinas_codigo_key" ON "dim_disciplinas"("codigo");
CREATE UNIQUE INDEX "dim_usuarios_email_key" ON "dim_usuarios"("email");
CREATE INDEX "dim_categorias_disciplinaId_idx" ON "dim_categorias"("disciplinaId");
CREATE INDEX "tbl_checklist_template_disciplinaId_idx" ON "tbl_checklist_template"("disciplinaId");
CREATE INDEX "tbl_checklist_template_categoriaId_idx" ON "tbl_checklist_template"("categoriaId");
CREATE INDEX "tbl_checklist_template_ativo_idx" ON "tbl_checklist_template"("ativo");
CREATE UNIQUE INDEX "tbl_template_aplicabilidade_fases_templateItemId_faseId_key" ON "tbl_template_aplicabilidade_fases"("templateItemId", "faseId");
CREATE INDEX "tbl_template_aplicabilidade_fases_templateItemId_idx" ON "tbl_template_aplicabilidade_fases"("templateItemId");
CREATE INDEX "tbl_template_aplicabilidade_fases_faseId_idx" ON "tbl_template_aplicabilidade_fases"("faseId");
CREATE UNIQUE INDEX "fato_auditorias_codigoAuditoria_key" ON "fato_auditorias"("codigoAuditoria");
CREATE UNIQUE INDEX "fato_auditorias_obraId_disciplinaId_faseId_revisao_key" ON "fato_auditorias"("obraId", "disciplinaId", "faseId", "revisao");
CREATE INDEX "fato_auditorias_obraId_idx" ON "fato_auditorias"("obraId");
CREATE INDEX "fato_auditorias_disciplinaId_idx" ON "fato_auditorias"("disciplinaId");
CREATE INDEX "fato_auditorias_faseId_idx" ON "fato_auditorias"("faseId");
CREATE INDEX "fato_auditorias_status_idx" ON "fato_auditorias"("status");
CREATE INDEX "fato_auditorias_auditorResponsavelId_idx" ON "fato_auditorias"("auditorResponsavelId");
CREATE INDEX "fato_auditorias_dataInicio_dataFimPrevista_idx" ON "fato_auditorias"("dataInicio", "dataFimPrevista");
CREATE INDEX "fato_auditoria_itens_auditoriaId_idx" ON "fato_auditoria_itens"("auditoriaId");
CREATE INDEX "fato_auditoria_itens_status_idx" ON "fato_auditoria_itens"("status");
CREATE INDEX "fato_auditoria_itens_categoriaId_idx" ON "fato_auditoria_itens"("categoriaId");
CREATE INDEX "fato_auditoria_itens_proximaRevisao_idx" ON "fato_auditoria_itens"("proximaRevisao");
CREATE INDEX "tbl_evidencias_anexos_auditoriaItemId_idx" ON "tbl_evidencias_anexos"("auditoriaItemId");
CREATE INDEX "tbl_itens_personalizados_salvos_auditoriaItemId_idx" ON "tbl_itens_personalizados_salvos"("auditoriaItemId");
CREATE INDEX "tbl_itens_personalizados_salvos_aprovado_idx" ON "tbl_itens_personalizados_salvos"("aprovado");
CREATE INDEX "tbl_historico_alteracoes_tabelaNome_registroId_idx" ON "tbl_historico_alteracoes"("tabelaNome", "registroId");
CREATE INDEX "tbl_historico_alteracoes_usuarioId_timestamp_idx" ON "tbl_historico_alteracoes"("usuarioId", "timestamp");
CREATE INDEX "tbl_historico_alteracoes_timestamp_idx" ON "tbl_historico_alteracoes"("timestamp");
CREATE UNIQUE INDEX "tbl_scores_calculados_auditoriaId_key" ON "tbl_scores_calculados"("auditoriaId");
CREATE INDEX "tbl_scores_calculados_auditoriaId_idx" ON "tbl_scores_calculados"("auditoriaId");
CREATE UNIQUE INDEX "tbl_scores_por_disciplina_auditoriaId_disciplinaId_key" ON "tbl_scores_por_disciplina"("auditoriaId", "disciplinaId");
CREATE INDEX "tbl_scores_por_disciplina_auditoriaId_idx" ON "tbl_scores_por_disciplina"("auditoriaId");
CREATE UNIQUE INDEX "tbl_scores_por_categoria_auditoriaId_categoriaId_key" ON "tbl_scores_por_categoria"("auditoriaId", "categoriaId");
CREATE INDEX "tbl_scores_por_categoria_auditoriaId_idx" ON "tbl_scores_por_categoria"("auditoriaId");
CREATE INDEX "tbl_relatorios_gerados_auditoriaId_idx" ON "tbl_relatorios_gerados"("auditoriaId");
CREATE INDEX "tbl_relatorios_gerados_tipoRelatorio_idx" ON "tbl_relatorios_gerados"("tipoRelatorio");

-- AddForeignKey
ALTER TABLE "dim_categorias" ADD CONSTRAINT "dim_categorias_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_checklist_template" ADD CONSTRAINT "tbl_checklist_template_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_checklist_template" ADD CONSTRAINT "tbl_checklist_template_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "dim_categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_checklist_template" ADD CONSTRAINT "tbl_checklist_template_inativadoPorId_fkey" FOREIGN KEY ("inativadoPorId") REFERENCES "dim_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_template_aplicabilidade_fases" ADD CONSTRAINT "tbl_template_aplicabilidade_fases_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "tbl_checklist_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_template_aplicabilidade_fases" ADD CONSTRAINT "tbl_template_aplicabilidade_fases_faseId_fkey" FOREIGN KEY ("faseId") REFERENCES "dim_fases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditorias" ADD CONSTRAINT "fato_auditorias_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "dim_obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditorias" ADD CONSTRAINT "fato_auditorias_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditorias" ADD CONSTRAINT "fato_auditorias_faseId_fkey" FOREIGN KEY ("faseId") REFERENCES "dim_fases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditorias" ADD CONSTRAINT "fato_auditorias_auditorResponsavelId_fkey" FOREIGN KEY ("auditorResponsavelId") REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditorias" ADD CONSTRAINT "fato_auditorias_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "dim_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_checklist_template" ADD CONSTRAINT "tbl_checklist_template_auditoriaOrigemId_fkey" FOREIGN KEY ("auditoriaOrigemId") REFERENCES "fato_auditorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditoria_itens" ADD CONSTRAINT "fato_auditoria_itens_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "fato_auditorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditoria_itens" ADD CONSTRAINT "fato_auditoria_itens_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "tbl_checklist_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditoria_itens" ADD CONSTRAINT "fato_auditoria_itens_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "dim_categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditoria_itens" ADD CONSTRAINT "fato_auditoria_itens_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fato_auditoria_itens" ADD CONSTRAINT "fato_auditoria_itens_avaliadoPorId_fkey" FOREIGN KEY ("avaliadoPorId") REFERENCES "dim_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_evidencias_anexos" ADD CONSTRAINT "tbl_evidencias_anexos_auditoriaItemId_fkey" FOREIGN KEY ("auditoriaItemId") REFERENCES "fato_auditoria_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_evidencias_anexos" ADD CONSTRAINT "tbl_evidencias_anexos_uploadedPorId_fkey" FOREIGN KEY ("uploadedPorId") REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_itens_personalizados_salvos" ADD CONSTRAINT "tbl_itens_personalizados_salvos_auditoriaItemId_fkey" FOREIGN KEY ("auditoriaItemId") REFERENCES "fato_auditoria_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_itens_personalizados_salvos" ADD CONSTRAINT "tbl_itens_personalizados_salvos_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_itens_personalizados_salvos" ADD CONSTRAINT "tbl_itens_personalizados_salvos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "dim_categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_itens_personalizados_salvos" ADD CONSTRAINT "tbl_itens_personalizados_salvos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_itens_personalizados_salvos" ADD CONSTRAINT "tbl_itens_personalizados_salvos_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "dim_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_itens_personalizados_salvos" ADD CONSTRAINT "tbl_itens_personalizados_salvos_promovidoTemplateId_fkey" FOREIGN KEY ("promovidoTemplateId") REFERENCES "tbl_checklist_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_historico_alteracoes" ADD CONSTRAINT "tbl_historico_alteracoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_scores_calculados" ADD CONSTRAINT "tbl_scores_calculados_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "fato_auditorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_scores_por_disciplina" ADD CONSTRAINT "tbl_scores_por_disciplina_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "fato_auditorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_scores_por_disciplina" ADD CONSTRAINT "tbl_scores_por_disciplina_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_scores_por_categoria" ADD CONSTRAINT "tbl_scores_por_categoria_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "fato_auditorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_scores_por_categoria" ADD CONSTRAINT "tbl_scores_por_categoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "dim_categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_relatorios_gerados" ADD CONSTRAINT "tbl_relatorios_gerados_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "fato_auditorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_relatorios_gerados" ADD CONSTRAINT "tbl_relatorios_gerados_geradoPorId_fkey" FOREIGN KEY ("geradoPorId") REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
