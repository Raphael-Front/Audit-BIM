-- Execute no SQL Editor do Supabase para diagnosticar TRIP WORLD HOME e TERRA UNNA zerados.
-- Query 1: Resumo por obra
SELECT
  o.nome AS obra,
  COUNT(DISTINCT a.id) AS total_auditorias,
  COUNT(DISTINCT sc."auditoriaId") AS aud_com_tbl_scores,
  COUNT(i.id) AS total_itens,
  COUNT(CASE WHEN i.status <> 'nao_aplicavel' THEN 1 END) AS itens_aplicaveis,
  COALESCE(SUM(CASE WHEN i.status <> 'nao_aplicavel' THEN i."pontosMaximoSnapshot" ELSE 0 END), 0)::numeric(10,2) AS pontos_max,
  COALESCE(SUM(i."pontosObtidos"), 0)::numeric(10,2) AS pontos_obtidos,
  CASE WHEN COALESCE(SUM(CASE WHEN i.status <> 'nao_aplicavel' THEN i."pontosMaximoSnapshot" ELSE 0 END), 0) > 0
    THEN ROUND((COALESCE(SUM(i."pontosObtidos"), 0) / NULLIF(SUM(CASE WHEN i.status <> 'nao_aplicavel' THEN i."pontosMaximoSnapshot" ELSE 0 END), 0)) * 100, 2)
    ELSE 0
  END AS score_calculado
FROM dim_obras o
JOIN fato_auditorias a ON a."obraId" = o.id AND a.status <> 'cancelada'
LEFT JOIN tbl_scores_calculados sc ON sc."auditoriaId" = a.id
LEFT JOIN fato_auditoria_itens i ON i."auditoriaId" = a.id
WHERE o.nome IN ('TRIP WORLD HOME', 'TERRA UNNA')
GROUP BY o.id, o.nome;

-- Query 2: Distribuição de status dos itens (explica por que pontos_obtidos = 0)
SELECT
  o.nome AS obra,
  i.status,
  COUNT(*) AS qtd,
  SUM(i."pontosObtidos") AS soma_pontos_obtidos,
  SUM(CASE WHEN i.status <> 'nao_aplicavel' THEN i."pontosMaximoSnapshot" ELSE 0 END) AS soma_pontos_max
FROM dim_obras o
JOIN fato_auditorias a ON a."obraId" = o.id AND a.status <> 'cancelada'
JOIN fato_auditoria_itens i ON i."auditoriaId" = a.id
WHERE o.nome IN ('TRIP WORLD HOME', 'TERRA UNNA')
GROUP BY o.id, o.nome, i.status
ORDER BY o.nome, i.status;
