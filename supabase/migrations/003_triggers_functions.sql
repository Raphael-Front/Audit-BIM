-- BR-03: Cálculo de score | BR-05: Snapshot de template | BR-07: Versionamento | Auditoria de sistema

-- BR-05: Snapshot de template — criar auditoria e clonar itens do template
CREATE OR REPLACE FUNCTION public.create_audit_from_template(
  p_obra_id UUID,
  p_template_id UUID,
  p_titulo TEXT DEFAULT NULL,
  p_data_planejada DATE DEFAULT NULL,
  p_auditor_responsavel UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_auditoria_id UUID;
  r RECORD;
BEGIN
  INSERT INTO auditorias (obra_id, template_id, titulo, data_planejada, auditor_responsavel, status)
  VALUES (p_obra_id, p_template_id, COALESCE(p_titulo, 'Nova auditoria'), p_data_planejada, p_auditor_responsavel, 'planejada')
  RETURNING id INTO v_auditoria_id;
  FOR r IN SELECT id, ordem, categoria, descricao, criticidade, requer_evidencia
            FROM template_itens WHERE template_id = p_template_id ORDER BY ordem, id
  LOOP
    INSERT INTO auditoria_itens (auditoria_id, template_item_id, ordem, descricao, categoria, criticidade, is_customizado)
    VALUES (v_auditoria_id, r.id, r.ordem, r.descricao, r.categoria, r.criticidade, false);
  END LOOP;
  RETURN v_auditoria_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BR-03: Score = (Conformes / (Total - N/A)) * 100
CREATE OR REPLACE FUNCTION public.calculate_audit_score(p_auditoria_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_avaliados BIGINT;
  conformes BIGINT;
  score DECIMAL(5,2);
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status_avaliacao = 'conforme')
  INTO total_avaliados, conformes
  FROM auditoria_itens
  WHERE auditoria_id = p_auditoria_id
    AND status_avaliacao != 'nao_aplicavel';
  IF total_avaliados IS NULL OR total_avaliados = 0 THEN
    RETURN NULL;
  END IF;
  score := ROUND((conformes::DECIMAL / total_avaliados) * 100, 2);
  UPDATE auditorias SET score_calculado = score, updated_at = NOW() WHERE id = p_auditoria_id;
  RETURN score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: recalcular score após INSERT/UPDATE/DELETE em auditoria_itens
CREATE OR REPLACE FUNCTION public.trigger_recalc_audit_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calculate_audit_score(OLD.auditoria_id);
    RETURN OLD;
  END IF;
  PERFORM public.calculate_audit_score(COALESCE(NEW.auditoria_id, OLD.auditoria_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_itens_recalc_score
  AFTER INSERT OR UPDATE OF status_avaliacao OR DELETE ON auditoria_itens
  FOR EACH ROW EXECUTE PROCEDURE public.trigger_recalc_audit_score();

-- BR-07: Versionamento de templates — incrementar versao ao atualizar
CREATE OR REPLACE FUNCTION public.trigger_template_bump_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.nome IS DISTINCT FROM NEW.nome OR
    OLD.disciplina IS DISTINCT FROM NEW.disciplina OR
    OLD.ativo IS DISTINCT FROM NEW.ativo
  ) THEN
    NEW.versao := OLD.versao + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER templates_bump_version
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE PROCEDURE public.trigger_template_bump_version();

-- Auditoria de sistema: registrar alterações em auditoria_logs (auditorias e auditoria_itens)
CREATE OR REPLACE FUNCTION public.trigger_audit_log_auditorias()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO auditoria_logs (auditoria_id, usuario_id, acao, detalhes)
    VALUES (NEW.id, auth.uid(), 'criacao', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria_logs (auditoria_id, usuario_id, acao, detalhes)
    VALUES (NEW.id, auth.uid(), 'mudanca_status', jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria_logs (auditoria_id, usuario_id, acao, detalhes)
    VALUES (OLD.id, auth.uid(), 'exclusao', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auditorias_log
  AFTER INSERT OR UPDATE OR DELETE ON auditorias
  FOR EACH ROW EXECUTE PROCEDURE public.trigger_audit_log_auditorias();

CREATE OR REPLACE FUNCTION public.trigger_audit_log_auditoria_itens()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO auditoria_logs (auditoria_id, usuario_id, acao, detalhes)
    VALUES (NEW.auditoria_id, auth.uid(), 'adicao_item', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' AND (OLD.status_avaliacao IS DISTINCT FROM NEW.status_avaliacao OR OLD.evidencias IS DISTINCT FROM NEW.evidencias) THEN
    INSERT INTO auditoria_logs (auditoria_id, usuario_id, acao, detalhes)
    VALUES (NEW.auditoria_id, auth.uid(), 'upload_evidencia', jsonb_build_object('item_id', NEW.id, 'before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auditoria_itens_log
  AFTER INSERT OR UPDATE ON auditoria_itens
  FOR EACH ROW EXECUTE PROCEDURE public.trigger_audit_log_auditoria_itens();
