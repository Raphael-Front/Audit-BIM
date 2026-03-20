-- Corrige itens com status conforme/corrigido que têm pontosObtidos = 0.
-- Execute no SQL Editor do Supabase para corrigir dados históricos (TRIP WORLD HOME, TERRA UNNA).

UPDATE fato_auditoria_itens i
SET "pontosObtidos" = i."pontosMaximoSnapshot"
WHERE i.status IN ('conforme', 'corrigido')
  AND (i."pontosObtidos" IS NULL OR i."pontosObtidos" = 0);

-- Recalcula tbl_scores_calculados para auditorias com itens conforme/corrigido
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT "auditoriaId" FROM fato_auditoria_itens WHERE status IN ('conforme', 'corrigido')
  LOOP
    PERFORM public.sync_audit_score(r."auditoriaId");
  END LOOP;
END $$;

-- Recalcula tbl_scores_por_obra para todas as obras
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT "obraId" FROM fato_auditorias WHERE status <> 'cancelada' AND "obraId" IS NOT NULL
  LOOP
    PERFORM public.sync_obra_score(r."obraId");
  END LOOP;
END $$;
