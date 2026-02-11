-- BIM Audit — Queries de exemplo (PostgreSQL)
-- Parâmetros: $1, $2, etc. conforme seu cliente (pg, Prisma raw, etc.)

-- ---------------------------------------------------------------------------
-- 1. Dashboard Kanban: auditorias por status (excl. cancelada)
--    Retorna: id, código, status, obra, disciplina, fase, score_geral, total de não conformes
-- ---------------------------------------------------------------------------
SELECT
  a.id,
  a.codigo_auditoria,
  a.status,
  o.nome AS obra_nome,
  d.nome AS disciplina_nome,
  f.nome AS fase_nome,
  sc.score_geral,
  COUNT(ai.id) FILTER (WHERE ai.status = 'nao_conforme') AS total_nao_conformes
FROM fato_auditorias a
JOIN dim_obras o ON a.obra_id = o.id
JOIN dim_disciplinas d ON a.disciplina_id = d.id
JOIN dim_fases f ON a.fase_id = f.id
LEFT JOIN tbl_scores_calculados sc ON a.id = sc.auditoria_id
LEFT JOIN fato_auditoria_itens ai ON a.id = ai.auditoria_id
WHERE a.status <> 'cancelada'
GROUP BY a.id, o.nome, d.nome, f.nome, sc.score_geral
ORDER BY a.data_inicio DESC;


-- ---------------------------------------------------------------------------
-- 2. Filtrar auditorias por obra, fase e período
--    Parâmetros: $1 = obra_id (UUID, opcional), $2 = fase_id (UUID, opcional),
--                $3 = data_inicio_from (DATE), $4 = data_inicio_to (DATE)
-- ---------------------------------------------------------------------------
SELECT
  a.id,
  a.codigo_auditoria,
  a.status,
  a.data_inicio,
  a.data_fim_prevista,
  o.nome AS obra_nome,
  f.nome AS fase_nome
FROM fato_auditorias a
JOIN dim_obras o ON a.obra_id = o.id
JOIN dim_fases f ON a.fase_id = f.id
WHERE ($1::UUID IS NULL OR a.obra_id = $1)
  AND ($2::UUID IS NULL OR a.fase_id = $2)
  AND a.data_inicio >= $3
  AND a.data_inicio <= $4
ORDER BY a.data_inicio DESC;


-- ---------------------------------------------------------------------------
-- 3. Histórico completo de um item de auditoria
--    Parâmetro: $1 = fato_auditoria_itens.id (UUID)
-- ---------------------------------------------------------------------------
SELECT
  id,
  tabela_nome,
  registro_id,
  campo_nome,
  valor_anterior,
  valor_novo,
  acao,
  usuario_id,
  timestamp
FROM tbl_historico_alteracoes
WHERE tabela_nome = 'fato_auditoria_itens'
  AND registro_id = $1
ORDER BY timestamp DESC;


-- ---------------------------------------------------------------------------
-- 4. Relatório de não conformidades por obra
--    Opcional: $1 = data_inicio_from, $2 = data_inicio_to (filtrar auditorias por período)
-- ---------------------------------------------------------------------------
SELECT
  o.id AS obra_id,
  o.nome AS obra_nome,
  COUNT(ai.id) FILTER (WHERE ai.status = 'nao_conforme') AS total_nao_conformes
FROM dim_obras o
LEFT JOIN fato_auditorias a ON a.obra_id = o.id
  AND ($1::DATE IS NULL OR a.data_inicio >= $1)
  AND ($2::DATE IS NULL OR a.data_inicio <= $2)
LEFT JOIN fato_auditoria_itens ai ON ai.auditoria_id = a.id
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.nome
ORDER BY total_nao_conformes DESC;


-- ---------------------------------------------------------------------------
-- 5. Próximas revisões críticas (itens não conformes com proxima_revisao nos próximos 7 dias)
-- ---------------------------------------------------------------------------
SELECT
  ai.id,
  ai.item_verificacao_snapshot,
  ai.proxima_revisao,
  a.codigo_auditoria,
  o.nome AS obra_nome
FROM fato_auditoria_itens ai
JOIN fato_auditorias a ON ai.auditoria_id = a.id
JOIN dim_obras o ON a.obra_id = o.id
WHERE ai.proxima_revisao <= CURRENT_DATE + INTERVAL '7 days'
  AND ai.status = 'nao_conforme'
ORDER BY ai.proxima_revisao ASC;
