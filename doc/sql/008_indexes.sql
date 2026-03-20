-- BIM Audit — Índices adicionais (Parte 3 da spec)
-- Parte dos índices já criada nos CREATE TABLE (004, 006). Este script adiciona os que faltam.

-- Full-text search em itens de auditoria (português)
CREATE INDEX idx_item_verificacao_fts ON fato_auditoria_itens
  USING gin(to_tsvector('portuguese', item_verificacao_snapshot));

-- Índices já criados em 004_fatos.sql e 006_historico.sql:
-- idx_auditoria_chave_unica, idx_auditoria_status, idx_auditoria_obra_status,
-- idx_auditoria_datas, idx_auditoria_auditor,
-- idx_auditoria_itens_auditoria, idx_auditoria_itens_status, idx_auditoria_itens_categoria,
-- idx_proxima_revisao (partial),
-- idx_historico_timestamp, idx_historico_entidade, idx_historico_usuario_timestamp
