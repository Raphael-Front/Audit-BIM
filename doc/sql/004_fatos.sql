-- BIM Audit — Fatos (fato_auditorias, fato_auditoria_itens)
-- Depende: 002_dimensoes.sql, 003_biblioteca.sql (para FK template_item_id)

CREATE TABLE fato_auditorias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_auditoria      VARCHAR(100) NOT NULL UNIQUE,
  obra_id               UUID NOT NULL REFERENCES dim_obras(id) ON DELETE RESTRICT,
  disciplina_id         UUID NOT NULL REFERENCES dim_disciplinas(id) ON DELETE RESTRICT,
  fase_id               UUID NOT NULL REFERENCES dim_fases(id) ON DELETE RESTRICT,
  revisao               INTEGER NOT NULL DEFAULT 1,
  titulo                VARCHAR(255),
  auditor_responsavel_id UUID NOT NULL REFERENCES dim_usuarios(id) ON DELETE RESTRICT,
  status                status_auditoria NOT NULL DEFAULT 'nao_iniciado',
  data_inicio           DATE NOT NULL,
  data_fim_prevista     DATE,
  data_finalizacao_real DATE,
  data_entrada_standby  TIMESTAMPTZ,
  data_conclusao        TIMESTAMPTZ,
  tempo_total_pausa     INTERVAL,
  motivo_cancelamento   TEXT,
  cancelado_por_id      UUID REFERENCES dim_usuarios(id) ON DELETE SET NULL,
  cancelado_em          TIMESTAMPTZ,
  observacoes_gerais    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(obra_id, disciplina_id, fase_id, revisao),
  CONSTRAINT chk_status_auditoria CHECK (status IN (
    'nao_iniciado', 'em_andamento', 'aguardando_apontamentos',
    'concluida', 'cancelada', 'pausada'
  ))
);

CREATE TABLE fato_auditoria_itens (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id               UUID NOT NULL REFERENCES fato_auditorias(id) ON DELETE CASCADE,
  template_item_id          UUID REFERENCES tbl_checklist_template(id) ON DELETE SET NULL,
  categoria_id              UUID NOT NULL REFERENCES dim_categorias(id) ON DELETE RESTRICT,
  disciplina_id             UUID NOT NULL REFERENCES dim_disciplinas(id) ON DELETE RESTRICT,
  item_verificacao_snapshot  TEXT NOT NULL,
  peso_snapshot             INTEGER NOT NULL,
  pontos_maximo_snapshot    DECIMAL(5,2) NOT NULL,
  tipo_item                 tipo_item_auditoria NOT NULL DEFAULT 'template',
  status                    status_item_auditoria NOT NULL DEFAULT 'nao_iniciado',
  evidencia_observacao      TEXT,
  codigo_construflow        VARCHAR(100),
  proxima_revisao           DATE,
  pontos_obtidos            DECIMAL(5,2) NOT NULL DEFAULT 0,
  avaliado_em               TIMESTAMPTZ,
  avaliado_por_id           UUID REFERENCES dim_usuarios(id) ON DELETE SET NULL,
  ordem_exibicao            INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_nao_conforme_evidencia CHECK (
    (status <> 'nao_conforme') OR (
      status = 'nao_conforme' AND evidencia_observacao IS NOT NULL
      AND codigo_construflow IS NOT NULL AND proxima_revisao IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX idx_auditoria_chave_unica ON fato_auditorias(obra_id, disciplina_id, fase_id, revisao);
CREATE INDEX idx_auditoria_status ON fato_auditorias(status);
CREATE INDEX idx_auditoria_obra_status ON fato_auditorias(obra_id, status);
CREATE INDEX idx_auditoria_datas ON fato_auditorias(data_inicio, data_fim_prevista);
CREATE INDEX idx_auditoria_auditor ON fato_auditorias(auditor_responsavel_id);

CREATE INDEX idx_auditoria_itens_auditoria ON fato_auditoria_itens(auditoria_id);
CREATE INDEX idx_auditoria_itens_status ON fato_auditoria_itens(status);
CREATE INDEX idx_auditoria_itens_categoria ON fato_auditoria_itens(categoria_id);
CREATE INDEX idx_proxima_revisao ON fato_auditoria_itens(proxima_revisao)
  WHERE proxima_revisao IS NOT NULL AND status = 'nao_conforme';
