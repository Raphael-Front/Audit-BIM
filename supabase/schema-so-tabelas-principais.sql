-- BIM Audit — Schema apenas com as tabelas principais (para importação de CSV)
-- Execute no Supabase SQL Editor ou: npx tsx scripts/run-schema-tabelas.ts

-- ENUMs
DO $$ BEGIN CREATE TYPE "perfil_usuario" AS ENUM ('admin_bim', 'auditor_bim', 'leitor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "origem_template" AS ENUM ('template_original', 'promovido_de_auditoria');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "status_auditoria" AS ENUM ('nao_iniciado', 'agendado', 'em_andamento', 'aguardando_apontamentos', 'concluida', 'cancelada', 'pausada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "tipo_item_auditoria" AS ENUM ('template', 'personalizado', 'promovido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "status_item_auditoria" AS ENUM ('nao_iniciado', 'conforme', 'nao_conforme', 'nao_aplicavel', 'corrigido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "acao_historico" AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'FINALIZAR_VERIFICACAO', 'ADICIONAR_ITEM_PERSONALIZADO', 'CONCLUIR_AUDITORIA', 'CANCELAR_AUDITORIA', 'PAUSAR', 'RETOMAR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "tipo_relatorio" AS ENUM ('parcial', 'tecnico_standby', 'final');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "formato_relatorio" AS ENUM ('pdf', 'xlsx');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- dim_obras
CREATE TABLE IF NOT EXISTS "dim_obras" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" VARCHAR(50) NOT NULL UNIQUE,
  "nome" VARCHAR(200) NOT NULL,
  "endereco" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ
);

-- dim_fases
CREATE TABLE IF NOT EXISTS "dim_fases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" VARCHAR(20) NOT NULL UNIQUE,
  "nome" VARCHAR(100) NOT NULL,
  "descricao" TEXT,
  "ordemSequencial" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- dim_disciplinas
CREATE TABLE IF NOT EXISTS "dim_disciplinas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" VARCHAR(20) NOT NULL UNIQUE,
  "nome" VARCHAR(100) NOT NULL,
  "descricao" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- dim_categorias
CREATE TABLE IF NOT EXISTS "dim_categorias" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" VARCHAR(50) NOT NULL,
  "nome" VARCHAR(200) NOT NULL,
  "descricao" TEXT,
  "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- dim_categorias_disciplinas
CREATE TABLE IF NOT EXISTS "dim_categorias_disciplinas" (
  "categoriaId" UUID NOT NULL,
  "disciplinaId" UUID NOT NULL,
  "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("categoriaId", "disciplinaId"),
  FOREIGN KEY ("categoriaId") REFERENCES "dim_categorias"("id") ON DELETE CASCADE,
  FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "dim_categorias_disciplinas_disciplinaId_idx" ON "dim_categorias_disciplinas"("disciplinaId");
CREATE INDEX IF NOT EXISTS "dim_categorias_disciplinas_categoriaId_idx" ON "dim_categorias_disciplinas"("categoriaId");

-- dim_usuarios
CREATE TABLE IF NOT EXISTS "dim_usuarios" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "nomeCompleto" VARCHAR(200) NOT NULL,
  "senhaHash" VARCHAR(255),
  "auth_user_id" UUID,
  "avatar_url" TEXT,
  "perfil" "perfil_usuario" NOT NULL DEFAULT 'auditor_bim',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ultimoAcesso" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- tbl_checklist_template (auditoriaOrigemId sem FK inicial - FK adicionada após fato_auditorias)
CREATE TABLE IF NOT EXISTS "tbl_checklist_template" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "versao" INTEGER NOT NULL DEFAULT 1,
  "disciplinaId" UUID NOT NULL REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT,
  "categoriaId" UUID NOT NULL REFERENCES "dim_categorias"("id") ON DELETE RESTRICT,
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
  "inativadoPorId" UUID REFERENCES "dim_usuarios"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "tbl_checklist_template_disciplinaId_idx" ON "tbl_checklist_template"("disciplinaId");
CREATE INDEX IF NOT EXISTS "tbl_checklist_template_categoriaId_idx" ON "tbl_checklist_template"("categoriaId");
CREATE INDEX IF NOT EXISTS "tbl_checklist_template_ativo_idx" ON "tbl_checklist_template"("ativo");

-- tbl_template_aplicabilidade_fases
CREATE TABLE IF NOT EXISTS "tbl_template_aplicabilidade_fases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "templateItemId" UUID NOT NULL REFERENCES "tbl_checklist_template"("id") ON DELETE CASCADE,
  "faseId" UUID NOT NULL REFERENCES "dim_fases"("id") ON DELETE CASCADE,
  "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("templateItemId", "faseId")
);
CREATE INDEX IF NOT EXISTS "tbl_template_aplicabilidade_fases_templateItemId_idx" ON "tbl_template_aplicabilidade_fases"("templateItemId");
CREATE INDEX IF NOT EXISTS "tbl_template_aplicabilidade_fases_faseId_idx" ON "tbl_template_aplicabilidade_fases"("faseId");

-- fato_auditorias
CREATE TABLE IF NOT EXISTS "fato_auditorias" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigoAuditoria" VARCHAR(100) NOT NULL UNIQUE,
  "obraId" UUID NOT NULL REFERENCES "dim_obras"("id") ON DELETE RESTRICT,
  "disciplinaId" UUID NOT NULL REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT,
  "faseId" UUID NOT NULL REFERENCES "dim_fases"("id") ON DELETE RESTRICT,
  "revisao" INTEGER NOT NULL DEFAULT 1,
  "titulo" VARCHAR(255),
  "auditorResponsavelId" UUID NOT NULL REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT,
  "status" "status_auditoria" NOT NULL DEFAULT 'nao_iniciado',
  "dataInicio" DATE NOT NULL,
  "dataFimPrevista" DATE,
  "dataFinalizacaoReal" DATE,
  "dataEntradaStandby" TIMESTAMPTZ,
  "dataConclusao" TIMESTAMPTZ,
  "tempoTotalPausa" TEXT,
  "motivoCancelamento" TEXT,
  "canceladoPorId" UUID REFERENCES "dim_usuarios"("id") ON DELETE SET NULL,
  "canceladoEm" TIMESTAMPTZ,
  "observacoesGerais" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("obraId", "disciplinaId", "faseId", "revisao")
);
CREATE INDEX IF NOT EXISTS "fato_auditorias_obraId_idx" ON "fato_auditorias"("obraId");
CREATE INDEX IF NOT EXISTS "fato_auditorias_disciplinaId_idx" ON "fato_auditorias"("disciplinaId");
CREATE INDEX IF NOT EXISTS "fato_auditorias_faseId_idx" ON "fato_auditorias"("faseId");
CREATE INDEX IF NOT EXISTS "fato_auditorias_status_idx" ON "fato_auditorias"("status");
CREATE INDEX IF NOT EXISTS "fato_auditorias_auditorResponsavelId_idx" ON "fato_auditorias"("auditorResponsavelId");

-- FK circular: tbl_checklist_template.auditoriaOrigemId -> fato_auditorias
ALTER TABLE "tbl_checklist_template" DROP CONSTRAINT IF EXISTS "tbl_checklist_template_auditoriaOrigemId_fkey";
ALTER TABLE "tbl_checklist_template" ADD CONSTRAINT "tbl_checklist_template_auditoriaOrigemId_fkey"
  FOREIGN KEY ("auditoriaOrigemId") REFERENCES "fato_auditorias"("id") ON DELETE SET NULL;

-- fato_auditoria_itens
CREATE TABLE IF NOT EXISTS "fato_auditoria_itens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "auditoriaId" UUID NOT NULL REFERENCES "fato_auditorias"("id") ON DELETE CASCADE,
  "templateItemId" UUID REFERENCES "tbl_checklist_template"("id") ON DELETE SET NULL,
  "categoriaId" UUID NOT NULL REFERENCES "dim_categorias"("id") ON DELETE RESTRICT,
  "disciplinaId" UUID NOT NULL REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT,
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
  "avaliadoPorId" UUID REFERENCES "dim_usuarios"("id") ON DELETE SET NULL,
  "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fato_auditoria_itens_auditoriaId_idx" ON "fato_auditoria_itens"("auditoriaId");
CREATE INDEX IF NOT EXISTS "fato_auditoria_itens_status_idx" ON "fato_auditoria_itens"("status");
CREATE INDEX IF NOT EXISTS "fato_auditoria_itens_categoriaId_idx" ON "fato_auditoria_itens"("categoriaId");

-- tbl_evidencias_anexos
CREATE TABLE IF NOT EXISTS "tbl_evidencias_anexos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "auditoriaItemId" UUID NOT NULL REFERENCES "fato_auditoria_itens"("id") ON DELETE CASCADE,
  "arquivoNome" VARCHAR(255) NOT NULL,
  "arquivoUrl" TEXT NOT NULL,
  "arquivoTipo" VARCHAR(50) NOT NULL,
  "arquivoTamanhoBytes" BIGINT NOT NULL,
  "descricao" TEXT,
  "uploadedPorId" UUID NOT NULL REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT,
  "uploadedEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tbl_evidencias_anexos_auditoriaItemId_idx" ON "tbl_evidencias_anexos"("auditoriaItemId");

-- tbl_itens_personalizados_salvos
CREATE TABLE IF NOT EXISTS "tbl_itens_personalizados_salvos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "auditoriaItemId" UUID NOT NULL REFERENCES "fato_auditoria_itens"("id") ON DELETE CASCADE,
  "disciplinaId" UUID NOT NULL REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT,
  "categoriaId" UUID NOT NULL REFERENCES "dim_categorias"("id") ON DELETE RESTRICT,
  "itemVerificacao" TEXT NOT NULL,
  "peso" INTEGER NOT NULL,
  "pontosMaximo" DECIMAL(5,2) NOT NULL,
  "criadoPorId" UUID NOT NULL REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT,
  "aprovado" BOOLEAN NOT NULL DEFAULT false,
  "aprovadoPorId" UUID REFERENCES "dim_usuarios"("id") ON DELETE SET NULL,
  "aprovadoEm" TIMESTAMPTZ,
  "promovidoTemplateId" UUID REFERENCES "tbl_checklist_template"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tbl_itens_personalizados_salvos_auditoriaItemId_idx" ON "tbl_itens_personalizados_salvos"("auditoriaItemId");
CREATE INDEX IF NOT EXISTS "tbl_itens_personalizados_salvos_aprovado_idx" ON "tbl_itens_personalizados_salvos"("aprovado");

-- tbl_historico_alteracoes
CREATE TABLE IF NOT EXISTS "tbl_historico_alteracoes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tabelaNome" VARCHAR(100) NOT NULL,
  "registroId" UUID NOT NULL,
  "campoNome" VARCHAR(100) NOT NULL,
  "valorAnterior" TEXT,
  "valorNovo" TEXT,
  "acao" "acao_historico" NOT NULL,
  "usuarioId" UUID NOT NULL REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT,
  "ipAddress" VARCHAR(45),
  "userAgent" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tbl_historico_alteracoes_tabelaNome_registroId_idx" ON "tbl_historico_alteracoes"("tabelaNome", "registroId");

-- tbl_scores_calculados
CREATE TABLE IF NOT EXISTS "tbl_scores_calculados" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "auditoriaId" UUID NOT NULL UNIQUE REFERENCES "fato_auditorias"("id") ON DELETE CASCADE,
  "scoreGeral" DECIMAL(5,2) NOT NULL,
  "totalItens" INTEGER NOT NULL,
  "totalAplicavel" INTEGER NOT NULL,
  "totalConforme" INTEGER NOT NULL,
  "totalNaoConforme" INTEGER NOT NULL,
  "totalNa" INTEGER NOT NULL,
  "pontosObtidos" DECIMAL(10,2) NOT NULL,
  "pontosPossiveis" DECIMAL(10,2) NOT NULL,
  "ultimaAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tbl_scores_calculados_auditoriaId_idx" ON "tbl_scores_calculados"("auditoriaId");

-- tbl_scores_por_disciplina
CREATE TABLE IF NOT EXISTS "tbl_scores_por_disciplina" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "auditoriaId" UUID NOT NULL REFERENCES "fato_auditorias"("id") ON DELETE CASCADE,
  "disciplinaId" UUID NOT NULL REFERENCES "dim_disciplinas"("id") ON DELETE RESTRICT,
  "scoreDisciplina" DECIMAL(5,2) NOT NULL,
  "totalItens" INTEGER NOT NULL,
  "totalAplicavel" INTEGER NOT NULL,
  "totalConforme" INTEGER NOT NULL,
  "totalNaoConforme" INTEGER NOT NULL,
  "totalNa" INTEGER NOT NULL,
  "pontosObtidos" DECIMAL(10,2) NOT NULL,
  "pontosPossiveis" DECIMAL(10,2) NOT NULL,
  "ultimaAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("auditoriaId", "disciplinaId")
);
CREATE INDEX IF NOT EXISTS "tbl_scores_por_disciplina_auditoriaId_idx" ON "tbl_scores_por_disciplina"("auditoriaId");

-- tbl_scores_por_categoria
CREATE TABLE IF NOT EXISTS "tbl_scores_por_categoria" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "auditoriaId" UUID NOT NULL REFERENCES "fato_auditorias"("id") ON DELETE CASCADE,
  "categoriaId" UUID NOT NULL REFERENCES "dim_categorias"("id") ON DELETE RESTRICT,
  "scoreCategoria" DECIMAL(5,2) NOT NULL,
  "totalItens" INTEGER NOT NULL,
  "totalAplicavel" INTEGER NOT NULL,
  "totalConforme" INTEGER NOT NULL,
  "totalNaoConforme" INTEGER NOT NULL,
  "totalNa" INTEGER NOT NULL,
  "pontosObtidos" DECIMAL(10,2) NOT NULL,
  "pontosPossiveis" DECIMAL(10,2) NOT NULL,
  "ultimaAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("auditoriaId", "categoriaId")
);
CREATE INDEX IF NOT EXISTS "tbl_scores_por_categoria_auditoriaId_idx" ON "tbl_scores_por_categoria"("auditoriaId");

-- tbl_relatorios_gerados
CREATE TABLE IF NOT EXISTS "tbl_relatorios_gerados" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "auditoriaId" UUID NOT NULL REFERENCES "fato_auditorias"("id") ON DELETE CASCADE,
  "tipoRelatorio" "tipo_relatorio" NOT NULL,
  "formato" "formato_relatorio" NOT NULL,
  "arquivoUrl" TEXT,
  "snapshotData" JSONB,
  "geradoPorId" UUID NOT NULL REFERENCES "dim_usuarios"("id") ON DELETE RESTRICT,
  "geradoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tbl_relatorios_gerados_auditoriaId_idx" ON "tbl_relatorios_gerados"("auditoriaId");

-- tbl_activity_logs
CREATE TABLE IF NOT EXISTS public.tbl_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.dim_usuarios(id) ON DELETE SET NULL,
  user_name VARCHAR(200),
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id UUID,
  entity_name VARCHAR(500),
  details TEXT,
  previous_value JSONB,
  new_value JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.tbl_activity_logs(created_at DESC);
