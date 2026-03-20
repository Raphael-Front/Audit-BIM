-- =============================================================================
-- PRÉ-VISUALIZAÇÃO: Duplicatas na biblioteca
-- Execute para ver o que seria removido pelo deduplicate-library.sql
-- Nenhuma alteração é feita - apenas consultas de leitura.
-- =============================================================================

-- Categorias duplicadas (por nome)
SELECT
  'Categoria duplicada' AS tipo,
  LOWER(TRIM(nome)) AS chave,
  count(*) AS qtd,
  array_agg(nome ORDER BY "createdAt") AS nomes,
  array_agg(id::text ORDER BY "createdAt") AS ids
FROM dim_categorias
GROUP BY LOWER(TRIM(nome))
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- Itens da biblioteca duplicados (por disciplina + categoria + texto)
SELECT
  'Item biblioteca duplicado' AS tipo,
  d.nome AS disciplina,
  c.nome AS categoria,
  LEFT(TRIM(t."itemVerificacao"), 80) AS item_preview,
  count(*) AS qtd,
  array_agg(t.id::text ORDER BY t."createdAt") AS ids
FROM tbl_checklist_template t
JOIN dim_disciplinas d ON d.id = t."disciplinaId"
JOIN dim_categorias c ON c.id = t."categoriaId"
GROUP BY t."disciplinaId", t."categoriaId", TRIM(t."itemVerificacao"), d.nome, c.nome
HAVING count(*) > 1
ORDER BY count(*) DESC;
