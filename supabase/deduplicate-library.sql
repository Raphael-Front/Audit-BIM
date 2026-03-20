-- =============================================================================
-- DEDUPLICAÇÃO DA BIBLIOTECA (categorias e itens)
-- Remove categorias e itens duplicados, mantendo 1 único de cada
-- SEM prejudicar auditorias existentes (apenas redireciona referências)
-- =============================================================================
-- Execute no Supabase SQL Editor. Faça backup antes se necessário.
-- Roda em transação: em caso de erro, nada é alterado.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. CATEGORIAS DUPLICADAS (por nome normalizado)
-- Critério: mesma categoria = mesmo nome (trim, lower)
-- Mantemos a mais antiga (menor id ou menor createdAt)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  id_mantido UUID;
  id_dup UUID;
BEGIN
  FOR r IN (
    -- Grupos de categorias duplicadas (mesmo nome normalizado)
    SELECT LOWER(TRIM(nome)) AS nome_norm, array_agg(id ORDER BY "createdAt", id) AS ids
    FROM dim_categorias
    GROUP BY LOWER(TRIM(nome))
    HAVING count(*) > 1
  ) LOOP
    id_mantido := r.ids[1];  -- primeiro = mais antigo

    FOR i IN 2..array_length(r.ids, 1) LOOP
      id_dup := r.ids[i];

      -- Copiar vínculos categoria-disciplina para a mantida (se não existirem)
      INSERT INTO dim_categorias_disciplinas ("categoriaId", "disciplinaId", "ordemExibicao", "createdAt")
      SELECT id_mantido, cd."disciplinaId", cd."ordemExibicao", cd."createdAt"
      FROM dim_categorias_disciplinas cd
      WHERE cd."categoriaId" = id_dup
      ON CONFLICT ("categoriaId", "disciplinaId") DO NOTHING;

      -- Remover scores da categoria duplicada (serão recalculados pelo trigger)
      DELETE FROM tbl_scores_por_categoria WHERE "categoriaId" = id_dup;

      -- Redirecionar referências para a categoria mantida
      UPDATE tbl_checklist_template SET "categoriaId" = id_mantido WHERE "categoriaId" = id_dup;
      UPDATE fato_auditoria_itens SET "categoriaId" = id_mantido WHERE "categoriaId" = id_dup;
      UPDATE tbl_itens_personalizados_salvos SET "categoriaId" = id_mantido WHERE "categoriaId" = id_dup;

      -- Remover duplicata (CASCADE limpa dim_categorias_disciplinas)
      DELETE FROM dim_categorias WHERE id = id_dup;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Categorias duplicadas removidas.';
END $$;

-- -----------------------------------------------------------------------------
-- 2. ITENS DA BIBLIOTECA DUPLICADOS (tbl_checklist_template)
-- Critério: mesmo item = mesma (disciplina, categoria, texto de verificação)
-- Mantemos o mais antigo
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  id_mantido UUID;
  id_dup UUID;
BEGIN
  FOR r IN (
    -- Grupos de templates duplicados
    SELECT
      "disciplinaId",
      "categoriaId",
      TRIM("itemVerificacao") AS item_norm,
      array_agg(id ORDER BY "createdAt", id) AS ids
    FROM tbl_checklist_template
    GROUP BY "disciplinaId", "categoriaId", TRIM("itemVerificacao")
    HAVING count(*) > 1
  ) LOOP
    id_mantido := r.ids[1];

    FOR i IN 2..array_length(r.ids, 1) LOOP
      id_dup := r.ids[i];

      -- Copiar aplicabilidade de fases para o template mantido (se não existir)
      INSERT INTO tbl_template_aplicabilidade_fases ("id", "templateItemId", "faseId", "obrigatorio", "createdAt")
      SELECT gen_random_uuid(), id_mantido, ap."faseId", ap."obrigatorio", ap."createdAt"
      FROM tbl_template_aplicabilidade_fases ap
      WHERE ap."templateItemId" = id_dup
      ON CONFLICT ("templateItemId", "faseId") DO NOTHING;

      -- Redirecionar referências para o template mantido
      UPDATE fato_auditoria_itens SET "templateItemId" = id_mantido WHERE "templateItemId" = id_dup;
      UPDATE tbl_itens_personalizados_salvos SET "promovidoTemplateId" = id_mantido WHERE "promovidoTemplateId" = id_dup;

      -- Remover duplicata (CASCADE limpa tbl_template_aplicabilidade_fases)
      DELETE FROM tbl_checklist_template WHERE id = id_dup;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Itens da biblioteca duplicados removidos.';
END $$;

COMMIT;

-- Resumo pós-execução (opcional, fora da transação)
SELECT 'Categorias' AS entidade, count(*) AS total FROM dim_categorias
UNION ALL
SELECT 'Itens biblioteca', count(*) FROM tbl_checklist_template WHERE ativo = true;
