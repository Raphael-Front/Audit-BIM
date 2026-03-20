-- BIM Audit — Rotina de limpeza automática de logs
-- Quando a tabela tbl_activity_logs atingir 2000 registros, remove os 1000 mais antigos

CREATE OR REPLACE FUNCTION public.trim_activity_logs_if_needed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_count integer;
BEGIN
  SELECT COUNT(*) INTO log_count FROM public.tbl_activity_logs;

  IF log_count >= 2000 THEN
    DELETE FROM public.tbl_activity_logs
    WHERE id IN (
      SELECT id FROM public.tbl_activity_logs
      ORDER BY created_at ASC
      LIMIT 1000
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger executado após cada INSERT
DROP TRIGGER IF EXISTS trg_trim_activity_logs ON public.tbl_activity_logs;
CREATE TRIGGER trg_trim_activity_logs
  AFTER INSERT ON public.tbl_activity_logs
  FOR EACH STATEMENT
  EXECUTE PROCEDURE public.trim_activity_logs_if_needed();

COMMENT ON FUNCTION public.trim_activity_logs_if_needed() IS 'Remove os 1000 registros mais antigos quando tbl_activity_logs atingir 2000 registros';
