-- BIM Audit — Schema inicial (PRD)
-- Tabelas: obras, templates, template_itens, auditorias, auditoria_itens, auditoria_logs

-- ENUMs
CREATE TYPE obra_status AS ENUM ('ativa', 'pausada', 'finalizada');
CREATE TYPE audit_status AS ENUM ('planejada', 'em_andamento', 'aguardando_apontamentos', 'concluida', 'cancelada');
CREATE TYPE item_status_avaliacao AS ENUM ('conforme', 'nao_conforme', 'nao_aplicavel', 'pendente');
CREATE TYPE criticidade_enum AS ENUM ('baixa', 'media', 'alta', 'critica');

-- Obras
CREATE TABLE obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT UNIQUE,
  cliente TEXT,
  endereco JSONB,
  status obra_status NOT NULL DEFAULT 'ativa',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_obras_status ON obras(status);
CREATE INDEX idx_obras_codigo ON obras(codigo) WHERE codigo IS NOT NULL;
CREATE INDEX idx_obras_deleted ON obras(deleted_at) WHERE deleted_at IS NULL;

-- Templates (biblioteca de checklists)
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  disciplina TEXT,
  versao INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_disciplina ON templates(disciplina);
CREATE INDEX idx_templates_ativo ON templates(ativo) WHERE ativo = true;

-- Itens do template (perguntas base)
CREATE TABLE template_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  categoria TEXT,
  descricao TEXT NOT NULL,
  criticidade criticidade_enum,
  requer_evidencia BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_itens_template ON template_itens(template_id);

-- Perfis de usuário (complementa auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  role TEXT NOT NULL DEFAULT 'auditor' CHECK (role IN ('admin', 'auditor', 'visualizador')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Auditorias (instâncias executadas)
CREATE TABLE auditorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  titulo TEXT,
  data_planejada DATE,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  status audit_status NOT NULL DEFAULT 'planejada',
  auditor_responsavel UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  score_calculado DECIMAL(5,2),
  observacoes_gerais TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_concluida_nc_construflow CHECK (
    status != 'concluida' OR NOT EXISTS (
      SELECT 1 FROM auditoria_itens ai
      WHERE ai.auditoria_id = auditorias.id
        AND ai.status_avaliacao = 'nao_conforme'
        AND (ai.construflow_id IS NULL OR ai.construflow_id = '')
    )
  )
);

CREATE INDEX idx_auditorias_obra ON auditorias(obra_id);
CREATE INDEX idx_auditorias_template ON auditorias(template_id);
CREATE INDEX idx_auditorias_status ON auditorias(status);
CREATE INDEX idx_auditorias_auditor ON auditorias(auditor_responsavel);
CREATE INDEX idx_auditorias_data_planejada ON auditorias(data_planejada);
CREATE INDEX idx_auditorias_deleted ON auditorias(deleted_at) WHERE deleted_at IS NULL;

-- Itens instanciados (snapshot do template)
CREATE TABLE auditoria_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id UUID NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES template_itens(id) ON DELETE SET NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL,
  categoria TEXT,
  criticidade criticidade_enum,
  status_avaliacao item_status_avaliacao NOT NULL DEFAULT 'pendente',
  construflow_id TEXT,
  observacoes TEXT,
  evidencias JSONB DEFAULT '[]',
  avaliado_em TIMESTAMPTZ,
  avaliado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_customizado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_itens_auditoria ON auditoria_itens(auditoria_id);
CREATE INDEX idx_auditoria_itens_status ON auditoria_itens(status_avaliacao);
CREATE INDEX idx_auditoria_itens_template_item ON auditoria_itens(template_item_id) WHERE template_item_id IS NOT NULL;

-- Log de alterações (auditoria de sistema)
CREATE TABLE auditoria_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id UUID REFERENCES auditorias(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  detalhes JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_logs_auditoria ON auditoria_logs(auditoria_id);
CREATE INDEX idx_auditoria_logs_usuario ON auditoria_logs(usuario_id);
CREATE INDEX idx_auditoria_logs_timestamp ON auditoria_logs(timestamp);

-- Trigger updated_at para obras
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER obras_updated_at BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER template_itens_updated_at BEFORE UPDATE ON template_itens
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER auditorias_updated_at BEFORE UPDATE ON auditorias
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER auditoria_itens_updated_at BEFORE UPDATE ON auditoria_itens
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
