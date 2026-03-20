-- BIM Audit — Anexos e itens personalizados salvos
-- Depende: 004_fatos.sql

CREATE TABLE tbl_evidencias_anexos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_item_id     UUID NOT NULL REFERENCES fato_auditoria_itens(id) ON DELETE CASCADE,
  arquivo_nome          VARCHAR(255) NOT NULL,
  arquivo_url           TEXT NOT NULL,
  arquivo_tipo          VARCHAR(50) NOT NULL,
  arquivo_tamanho_bytes BIGINT NOT NULL,
  descricao             TEXT,
  uploaded_por_id       UUID NOT NULL REFERENCES dim_usuarios(id) ON DELETE RESTRICT,
  uploaded_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tbl_evidencias_auditoria_item ON tbl_evidencias_anexos(auditoria_item_id);

CREATE TABLE tbl_itens_personalizados_salvos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_item_id     UUID NOT NULL REFERENCES fato_auditoria_itens(id) ON DELETE CASCADE,
  disciplina_id         UUID NOT NULL REFERENCES dim_disciplinas(id) ON DELETE RESTRICT,
  categoria_id          UUID NOT NULL REFERENCES dim_categorias(id) ON DELETE RESTRICT,
  item_verificacao      TEXT NOT NULL,
  peso                  INTEGER NOT NULL,
  pontos_maximo         DECIMAL(5,2) NOT NULL,
  criado_por_id         UUID NOT NULL REFERENCES dim_usuarios(id) ON DELETE RESTRICT,
  aprovado              BOOLEAN NOT NULL DEFAULT false,
  aprovado_por_id       UUID REFERENCES dim_usuarios(id) ON DELETE SET NULL,
  aprovado_em           TIMESTAMPTZ,
  promovido_template_id UUID REFERENCES tbl_checklist_template(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tbl_itens_pers_auditoria_item ON tbl_itens_personalizados_salvos(auditoria_item_id);
CREATE INDEX idx_tbl_itens_pers_aprovado ON tbl_itens_personalizados_salvos(aprovado);
