-- Corrige score: calcula pelos STATUS dos itens (igual ao relatório), não por pontosObtidos.
-- Garante que lista/cartões mostrem o mesmo score que o relatório.

CREATE OR REPLACE FUNCTION public.sync_audit_score(p_auditoria_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score           DECIMAL(5, 2);
  v_total_itens     INTEGER;
  v_total_aplicavel INTEGER;
  v_total_conforme  INTEGER;
  v_total_nao_conforme INTEGER;
  v_total_na        INTEGER;
  v_pontos_obtidos  DECIMAL(10, 2);
  v_pontos_maximo   DECIMAL(10, 2);
BEGIN
  -- Pontos obtidos: conforme/corrigido = 100%, nao_conforme = 0%, nao_iniciado = 0
  -- (mesma lógica do relatório computeAuditScores)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status <> 'nao_aplicavel'),
    COUNT(*) FILTER (WHERE status IN ('conforme', 'corrigido')),
    COUNT(*) FILTER (WHERE status = 'nao_conforme'),
    COUNT(*) FILTER (WHERE status = 'nao_aplicavel'),
    COALESCE(SUM(
      CASE
        WHEN status IN ('conforme', 'corrigido') THEN "pontosMaximoSnapshot"
        WHEN status = 'nao_conforme' OR status = 'nao_iniciado' THEN 0
        WHEN status <> 'nao_aplicavel' THEN COALESCE("pontosObtidos", 0)
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(CASE WHEN status <> 'nao_aplicavel' THEN "pontosMaximoSnapshot" ELSE 0 END), 0)
  INTO
    v_total_itens,
    v_total_aplicavel,
    v_total_conforme,
    v_total_nao_conforme,
    v_total_na,
    v_pontos_obtidos,
    v_pontos_maximo
  FROM public.fato_auditoria_itens
  WHERE "auditoriaId" = p_auditoria_id;

  IF v_total_itens IS NULL OR v_total_itens = 0 OR v_pontos_maximo = 0 OR v_pontos_maximo IS NULL THEN
    DELETE FROM public.tbl_scores_calculados WHERE "auditoriaId" = p_auditoria_id;
    RETURN;
  END IF;

  v_score := LEAST(100, ROUND((v_pontos_obtidos / v_pontos_maximo) * 100, 2));

  INSERT INTO public.tbl_scores_calculados (
    "auditoriaId",
    "scoreGeral",
    "totalItens",
    "totalAplicavel",
    "totalConforme",
    "totalNaoConforme",
    "totalNa",
    "pontosObtidos",
    "pontosPossiveis"
  ) VALUES (
    p_auditoria_id,
    v_score,
    COALESCE(v_total_itens, 0),
    COALESCE(v_total_aplicavel, 0),
    COALESCE(v_total_conforme, 0),
    COALESCE(v_total_nao_conforme, 0),
    COALESCE(v_total_na, 0),
    v_pontos_obtidos,
    v_pontos_maximo
  )
  ON CONFLICT ("auditoriaId") DO UPDATE SET
    "scoreGeral" = EXCLUDED."scoreGeral",
    "totalItens" = EXCLUDED."totalItens",
    "totalAplicavel" = EXCLUDED."totalAplicavel",
    "totalConforme" = EXCLUDED."totalConforme",
    "totalNaoConforme" = EXCLUDED."totalNaoConforme",
    "totalNa" = EXCLUDED."totalNa",
    "pontosObtidos" = EXCLUDED."pontosObtidos",
    "pontosPossiveis" = EXCLUDED."pontosPossiveis",
    "ultimaAtualizacao" = NOW();
END;
$$;

-- Recalcula todos os scores
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT "auditoriaId" FROM public.fato_auditoria_itens
  LOOP
    PERFORM public.sync_audit_score(r."auditoriaId");
  END LOOP;
END $$;

-- Recalcula scores por obra
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT "obraId" FROM public.fato_auditorias WHERE "obraId" IS NOT NULL
  LOOP
    PERFORM public.sync_obra_score(r."obraId");
  END LOOP;
END $$;
