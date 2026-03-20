-- BIM Audit — Biblioteca de templates (tbl_checklist_template, tbl_template_aplicabilidade_fases)
-- Depende: 002_dimensoes.sql (dim_disciplinas, dim_categorias, dim_fases, dim_usuarios)
-- Nota: fato_auditorias é referenciada; rodar 004_fatos.sql antes ou criar tabela stub. Aqui assumimos ordem 003 antes 004, então auditoria_origem_id FK será adicionada após criar fato_auditorias.

CREATE TABLE tbl_checklist_template (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao                INTEGER NOT NULL DEFAULT 1,
  disciplina_id         UUID NOT NULL REFERENCES dim_disciplinas(id) ON DELETE RESTRICT,
  categoria_id          UUID NOT NULL REFERENCES dim_categorias(id) ON DELETE RESTRICT,
  item_verificacao      TEXT NOT NULL,
  peso                  INTEGER NOT NULL,
  pontos_maximo         DECIMAL(5,2) NOT NULL,
  origem                origem_template NOT NULL DEFAULT 'template_original',
  auditoria_origem_id    UUID,
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  ordem_exibicao        INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inativado_em          TIMESTAMPTZ,
  inativado_por_id      UUID REFERENCES dim_usuarios(id) ON DELETE SET NULL
);

CREATE INDEX idx_tbl_checklist_template_disciplina ON tbl_checklist_template(disciplina_id);
CREATE INDEX idx_tbl_checklist_template_categoria ON tbl_checklist_template(categoria_id);
CREATE INDEX idx_tbl_checklist_template_ativo ON tbl_checklist_template(ativo);

-- FK para auditoria_origem: adicionar após fato_auditorias existir
-- ALTER TABLE tbl_checklist_template ADD CONSTRAINT fk_template_auditoria_origem
--   FOREIGN KEY (auditoria_origem_id) REFERENCES fato_auditorias(id) ON DELETE SET NULL;

CREATE TABLE tbl_template_aplicabilidade_fases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_item_id  UUID NOT NULL REFERENCES tbl_checklist_template(id) ON DELETE CASCADE,
  fase_id           UUID NOT NULL REFERENCES dim_fases(id) ON DELETE CASCADE,
  obrigatorio       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_item_id, fase_id)
);

CREATE INDEX idx_tbl_aplicabilidade_template ON tbl_template_aplicabilidade_fases(template_item_id);
CREATE INDEX idx_tbl_aplicabilidade_fase ON tbl_template_aplicabilidade_fases(fase_id);
