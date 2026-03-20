-- Tabela de resumo/relatório geral da obra: score médio pré-calculado.
-- Atualizada automaticamente quando auditorias são concluídas ou scores mudam.

CREATE TABLE IF NOT EXISTS public.tbl_scores_por_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "obraId" UUID NOT NULL UNIQUE REFERENCES public.dim_obras(id) ON DELETE CASCADE,
  "scoreMedio" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "totalAuditorias" INTEGER NOT NULL DEFAULT 0,
  "scoreMedioUltimoMes" DECIMAL(5,2),
  "ultimaAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbl_scores_por_obra_obraId ON public.tbl_scores_por_obra("obraId");
CREATE INDEX IF NOT EXISTS idx_tbl_scores_por_obra_scoreMedio ON public.tbl_scores_por_obra("scoreMedio");

-- RLS: mesma política das outras tbl_scores
ALTER TABLE public.tbl_scores_por_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tbl_scores_por_obra_admin" ON public.tbl_scores_por_obra FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_scores_por_obra_auditor" ON public.tbl_scores_por_obra FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "tbl_scores_por_obra_visualizador" ON public.tbl_scores_por_obra FOR SELECT USING (public.get_user_role() = 'visualizador');

-- Função: recalcula e persiste o score médio de uma obra
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

  WITH aud_concluidas AS (
    SELECT a.id, a."dataInicio", sc."scoreGeral"
    FROM public.fato_auditorias a
    JOIN public.tbl_scores_calculados sc ON sc."auditoriaId" = a.id
    WHERE a."obraId" = p_obra_id
      AND a.status <> 'cancelada'
  )
  SELECT
    COALESCE(ROUND(AVG("scoreGeral")::numeric, 2), 0),
    COUNT(*),
    (SELECT ROUND(AVG("scoreGeral")::numeric, 2) FROM aud_concluidas WHERE "dataInicio"::date >= v_data_limite)
  INTO v_score_medio, v_total, v_score_ultimo_mes
  FROM aud_concluidas;

  INSERT INTO public.tbl_scores_por_obra ("obraId", "scoreMedio", "totalAuditorias", "scoreMedioUltimoMes", "ultimaAtualizacao")
  VALUES (p_obra_id, COALESCE(v_score_medio, 0), COALESCE(v_total, 0), v_score_ultimo_mes, NOW())
  ON CONFLICT ("obraId") DO UPDATE SET
    "scoreMedio" = EXCLUDED."scoreMedio",
    "totalAuditorias" = EXCLUDED."totalAuditorias",
    "scoreMedioUltimoMes" = EXCLUDED."scoreMedioUltimoMes",
    "ultimaAtualizacao" = NOW();
END;
$$;

-- Trigger: ao inserir/atualizar tbl_scores_calculados, sincronizar a obra
CREATE OR REPLACE FUNCTION public.trg_fn_sync_obra_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_obra_id UUID;
BEGIN
  SELECT "obraId" INTO v_obra_id FROM public.fato_auditorias WHERE id = COALESCE(NEW."auditoriaId", OLD."auditoriaId");
  IF v_obra_id IS NOT NULL THEN
    PERFORM public.sync_obra_score(v_obra_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_obra_score ON public.tbl_scores_calculados;
CREATE TRIGGER trg_sync_obra_score
  AFTER INSERT OR UPDATE ON public.tbl_scores_calculados
  FOR EACH ROW EXECUTE PROCEDURE public.trg_fn_sync_obra_score();

-- Trigger: ao excluir de tbl_scores_calculados (ex: auditoria excluída), sincronizar a obra
CREATE OR REPLACE FUNCTION public.trg_fn_sync_obra_score_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_obra_id UUID;
BEGIN
  SELECT "obraId" INTO v_obra_id FROM public.fato_auditorias WHERE id = OLD."auditoriaId";
  IF v_obra_id IS NOT NULL THEN
    PERFORM public.sync_obra_score(v_obra_id);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_obra_score_on_delete ON public.tbl_scores_calculados;
CREATE TRIGGER trg_sync_obra_score_on_delete
  AFTER DELETE ON public.tbl_scores_calculados
  FOR EACH ROW EXECUTE PROCEDURE public.trg_fn_sync_obra_score_on_delete();

-- Trigger: ao concluir auditoria (status -> concluida), garantir que a obra seja sincronizada
-- (sync_audit_score já atualiza tbl_scores_calculados, que dispara trg_sync_obra_score;
-- mas se o status mudar sem alteração de itens, precisamos forçar)
CREATE OR REPLACE FUNCTION public.trg_fn_sync_obra_on_audit_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'concluida' AND (OLD.status IS NULL OR OLD.status <> 'concluida') AND NEW."obraId" IS NOT NULL THEN
    PERFORM public.sync_obra_score(NEW."obraId");
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_obra_on_audit_status ON public.fato_auditorias;
CREATE TRIGGER trg_sync_obra_on_audit_status
  AFTER UPDATE OF status ON public.fato_auditorias
  FOR EACH ROW EXECUTE PROCEDURE public.trg_fn_sync_obra_on_audit_status();

-- Popular tabela com dados existentes
INSERT INTO public.tbl_scores_por_obra ("obraId", "scoreMedio", "totalAuditorias", "scoreMedioUltimoMes", "ultimaAtualizacao")
SELECT
  a."obraId",
  ROUND(AVG(sc."scoreGeral")::numeric, 2),
  COUNT(*),
  (SELECT ROUND(AVG(sc2."scoreGeral")::numeric, 2)
   FROM public.fato_auditorias a2
   JOIN public.tbl_scores_calculados sc2 ON sc2."auditoriaId" = a2.id
   WHERE a2."obraId" = a."obraId" AND a2.status <> 'cancelada'
     AND a2."dataInicio"::date >= CURRENT_DATE - INTERVAL '30 days'),
  NOW()
FROM public.fato_auditorias a
JOIN public.tbl_scores_calculados sc ON sc."auditoriaId" = a.id
WHERE a.status <> 'cancelada' AND a."obraId" IS NOT NULL
GROUP BY a."obraId"
ON CONFLICT ("obraId") DO UPDATE SET
  "scoreMedio" = EXCLUDED."scoreMedio",
  "totalAuditorias" = EXCLUDED."totalAuditorias",
  "scoreMedioUltimoMes" = EXCLUDED."scoreMedioUltimoMes",
  "ultimaAtualizacao" = NOW();
