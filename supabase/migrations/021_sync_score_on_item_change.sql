-- Corrige inconsistência: cartão mostra 100% mas relatório mostra score real (ex: 68.2%).
-- Causa: tbl_scores_calculados não era atualizado quando itens mudavam (faltava trigger).
-- Também corrige itens nao_conforme com pontosObtidos incorreto e recalcula scores.

-- 1. Corrige pontosObtidos: itens nao_conforme devem ter 0
UPDATE public.fato_auditoria_itens
SET "pontosObtidos" = 0
WHERE status = 'nao_conforme'
  AND ("pontosObtidos" IS NULL OR "pontosObtidos" > 0);

-- 2. Trigger: ao inserir/atualizar/deletar itens, recalcular score da auditoria
CREATE OR REPLACE FUNCTION public.trg_fn_sync_audit_score_on_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_auditoria_id UUID;
BEGIN
  v_auditoria_id := COALESCE(NEW."auditoriaId", OLD."auditoriaId");
  IF v_auditoria_id IS NOT NULL THEN
    PERFORM public.sync_audit_score(v_auditoria_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_audit_score_on_item ON public.fato_auditoria_itens;
CREATE TRIGGER trg_sync_audit_score_on_item
  AFTER INSERT OR UPDATE OF status, "pontosObtidos", "pontosMaximoSnapshot" OR DELETE
  ON public.fato_auditoria_itens
  FOR EACH ROW EXECUTE PROCEDURE public.trg_fn_sync_audit_score_on_item();

-- 3. Recalcula tbl_scores_calculados para todas as auditorias (corrige cache desatualizado)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT "auditoriaId" FROM public.fato_auditoria_itens
  LOOP
    PERFORM public.sync_audit_score(r."auditoriaId");
  END LOOP;
END $$;

-- 4. Recalcula tbl_scores_por_obra
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT "obraId" FROM public.fato_auditorias WHERE "obraId" IS NOT NULL
  LOOP
    PERFORM public.sync_obra_score(r."obraId");
  END LOOP;
END $$;
