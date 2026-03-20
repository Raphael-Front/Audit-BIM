-- BIM Audit — Histórico de alterações (audit trail por campo)
-- Depende: 002_dimensoes.sql (dim_usuarios)

CREATE TABLE tbl_historico_alteracoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_nome    VARCHAR(100) NOT NULL,
  registro_id    UUID NOT NULL,
  campo_nome     VARCHAR(100) NOT NULL,
  valor_anterior TEXT,
  valor_novo     TEXT,
  acao          acao_historico NOT NULL,
  usuario_id     UUID NOT NULL REFERENCES dim_usuarios(id) ON DELETE RESTRICT,
  ip_address     INET,
  user_agent    TEXT,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historico_timestamp ON tbl_historico_alteracoes(timestamp DESC);
CREATE INDEX idx_historico_entidade ON tbl_historico_alteracoes(tabela_nome, registro_id);
CREATE INDEX idx_historico_usuario_timestamp ON tbl_historico_alteracoes(usuario_id, timestamp);
