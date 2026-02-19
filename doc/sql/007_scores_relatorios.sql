-- BIM Audit — Scores materializados e relatórios gerados
-- Depende: 004_fatos.sql

CREATE TABLE tbl_scores_calculados (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id       UUID NOT NULL UNIQUE REFERENCES fato_auditorias(id) ON DELETE CASCADE,
  score_geral        DECIMAL(5,2) NOT NULL,
  total_itens        INTEGER NOT NULL,
  total_aplicavel    INTEGER NOT NULL,
  total_conforme     INTEGER NOT NULL,
  total_nao_conforme  INTEGER NOT NULL,
  total_na           INTEGER NOT NULL,
  pontos_obtidos     DECIMAL(10,2) NOT NULL,
  pontos_possiveis   DECIMAL(10,2) NOT NULL,
  ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tbl_scores_calc_auditoria ON tbl_scores_calculados(auditoria_id);

CREATE TABLE tbl_scores_por_disciplina (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id       UUID NOT NULL REFERENCES fato_auditorias(id) ON DELETE CASCADE,
  disciplina_id      UUID NOT NULL REFERENCES dim_disciplinas(id) ON DELETE RESTRICT,
  score_disciplina   DECIMAL(5,2) NOT NULL,
  total_itens        INTEGER NOT NULL,
  total_aplicavel    INTEGER NOT NULL,
  total_conforme     INTEGER NOT NULL,
  total_nao_conforme INTEGER NOT NULL,
  total_na           INTEGER NOT NULL,
  pontos_obtidos    DECIMAL(10,2) NOT NULL,
  pontos_possiveis   DECIMAL(10,2) NOT NULL,
  ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(auditoria_id, disciplina_id)
);

CREATE INDEX idx_tbl_scores_disc_auditoria ON tbl_scores_por_disciplina(auditoria_id);

CREATE TABLE tbl_scores_por_categoria (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id       UUID NOT NULL REFERENCES fato_auditorias(id) ON DELETE CASCADE,
  categoria_id       UUID NOT NULL REFERENCES dim_categorias(id) ON DELETE RESTRICT,
  score_categoria    DECIMAL(5,2) NOT NULL,
  total_itens        INTEGER NOT NULL,
  total_aplicavel    INTEGER NOT NULL,
  total_conforme     INTEGER NOT NULL,
  total_nao_conforme INTEGER NOT NULL,
  total_na           INTEGER NOT NULL,
  pontos_obtidos     DECIMAL(10,2) NOT NULL,
  pontos_possiveis   DECIMAL(10,2) NOT NULL,
  ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(auditoria_id, categoria_id)
);

CREATE INDEX idx_tbl_scores_cat_auditoria ON tbl_scores_por_categoria(auditoria_id);

CREATE TABLE tbl_relatorios_gerados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id  UUID NOT NULL REFERENCES fato_auditorias(id) ON DELETE CASCADE,
  tipo_relatorio tipo_relatorio NOT NULL,
  formato       formato_relatorio NOT NULL,
  arquivo_url   TEXT,
  snapshot_data JSONB,
  gerado_por_id UUID NOT NULL REFERENCES dim_usuarios(id) ON DELETE RESTRICT,
  gerado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tbl_relatorios_auditoria ON tbl_relatorios_gerados(auditoria_id);
CREATE INDEX idx_tbl_relatorios_tipo ON tbl_relatorios_gerados(tipo_relatorio);
