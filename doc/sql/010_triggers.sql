-- BIM Audit — Triggers: recálculo de scores e RULE contra DELETE em auditorias
-- Depende: 009_functions.sql, 004_fatos.sql

-- Trigger: após INSERT/UPDATE/DELETE em fato_auditoria_itens, recalcular scores da auditoria afetada.
CREATE OR REPLACE FUNCTION trg_fn_atualizar_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_auditoria_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_auditoria_id := OLD.auditoria_id;
  ELSE
    v_auditoria_id := NEW.auditoria_id;
  END IF;
  PERFORM fn_recalcular_scores(v_auditoria_id);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_scores ON fato_auditoria_itens;
CREATE TRIGGER trg_atualizar_scores
  AFTER INSERT OR UPDATE OR DELETE ON fato_auditoria_itens
  FOR EACH ROW
  EXECUTE PROCEDURE trg_fn_atualizar_scores();

-- Impedir DELETE físico em fato_auditorias (soft delete via status = 'cancelada').
CREATE RULE rule_no_delete_auditoria AS
  ON DELETE TO fato_auditorias
  DO INSTEAD NOTHING;
