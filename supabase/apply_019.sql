-- Execute no SQL Editor do Supabase (Dashboard → SQL Editor)
-- Corrige sync_obra_score para incluir auditorias sem tbl_scores_calculados
-- (usa fato_auditoria_itens como fallback). Corrige obras zeradas (TRIP WORLD HOME, TERRA UNNA).

CREATE OR REPLACE FUNCTION public.sync_obra_score(p_obra_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score_medio DECIMAL(5,2);
  v_total INTEGER;
  v_score_ultimo_mes DECIMAL(5,2);
  v_data_limite DATE;
BEGIN
  v_data_limite := CURRENT_DATE - INTERVAL '30 days';

  WITH aud_base AS (
    SELECT a.id, a."dataInicio"
    FROM public.fato_auditorias a
    WHERE a."obraId" = p_obra_id
      AND a.status <> 'cancelada'
  ),
  scores_tbl AS (
    SELECT ab.id, ab."dataInicio", sc."scoreGeral" AS score
    FROM aud_base ab
    JOIN public.tbl_scores_calculados sc ON sc."auditoriaId" = ab.id
    WHERE sc."scoreGeral" IS NOT NULL
  ),
  aud_sem_score AS (
    SELECT ab.id, ab."dataInicio"
    FROM aud_base ab
    WHERE NOT EXISTS (SELECT 1 FROM public.tbl_scores_calculados sc WHERE sc."auditoriaId" = ab.id)
  ),
  scores_itens AS (
    SELECT asi.id, asi."dataInicio",
      CASE WHEN COALESCE(SUM(CASE WHEN i.status <> 'nao_aplicavel' THEN i."pontosMaximoSnapshot" ELSE 0 END), 0) > 0
        THEN ROUND((COALESCE(SUM(i."pontosObtidos"), 0) / NULLIF(SUM(CASE WHEN i.status <> 'nao_aplicavel' THEN i."pontosMaximoSnapshot" ELSE 0 END), 0)) * 100, 2)
        ELSE 0
      END AS score
    FROM aud_sem_score asi
    LEFT JOIN public.fato_auditoria_itens i ON i."auditoriaId" = asi.id
    GROUP BY asi.id, asi."dataInicio"
  ),
  todos_scores AS (
    SELECT id, "dataInicio", score FROM scores_tbl
    UNION ALL
    SELECT id, "dataInicio", score FROM scores_itens
  )
  SELECT
    COALESCE(ROUND(AVG(score)::numeric, 2), 0),
    COUNT(*),
    (SELECT ROUND(AVG(score)::numeric, 2) FROM todos_scores WHERE "dataInicio"::date >= v_data_limite)
  INTO v_score_medio, v_total, v_score_ultimo_mes
  FROM todos_scores;

  INSERT INTO public.tbl_scores_por_obra ("obraId", "scoreMedio", "totalAuditorias", "scoreMedioUltimoMes", "ultimaAtualizacao")
  VALUES (p_obra_id, COALESCE(v_score_medio, 0), COALESCE(v_total, 0), v_score_ultimo_mes, NOW())
  ON CONFLICT ("obraId") DO UPDATE SET
    "scoreMedio" = EXCLUDED."scoreMedio",
    "totalAuditorias" = EXCLUDED."totalAuditorias",
    "scoreMedioUltimoMes" = EXCLUDED."scoreMedioUltimoMes",
    "ultimaAtualizacao" = NOW();
END;
$$;

-- Re-sincronizar todas as obras para corrigir dados existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT "obraId" FROM public.fato_auditorias WHERE status <> 'cancelada' AND "obraId" IS NOT NULL
  LOOP
    PERFORM public.sync_obra_score(r."obraId");
  END LOOP;
END $$;
