-- Execute no SQL Editor do Supabase (Dashboard → SQL Editor)
-- Aplica apenas as migrações 017 e 018 (o banco já tem 001-016)

-- ========== 017: Permitir todos os usuários ver auditorias e itens ==========
DROP POLICY IF EXISTS "fato_auditorias_auditor" ON public.fato_auditorias;
DROP POLICY IF EXISTS "fato_auditorias_auditor_select" ON public.fato_auditorias;
DROP POLICY IF EXISTS "fato_auditorias_auditor_modify" ON public.fato_auditorias;
CREATE POLICY "fato_auditorias_auditor_select" ON public.fato_auditorias
  FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "fato_auditorias_auditor_modify" ON public.fato_auditorias
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND "auditorResponsavelId" = public.get_dim_usuario_id()
  ) WITH CHECK (
    public.get_user_role() = 'auditor' AND "auditorResponsavelId" = public.get_dim_usuario_id()
  );

DROP POLICY IF EXISTS "fato_auditoria_itens_auditor" ON public.fato_auditoria_itens;
DROP POLICY IF EXISTS "fato_auditoria_itens_auditor_select" ON public.fato_auditoria_itens;
DROP POLICY IF EXISTS "fato_auditoria_itens_auditor_modify" ON public.fato_auditoria_itens;
CREATE POLICY "fato_auditoria_itens_auditor_select" ON public.fato_auditoria_itens
  FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "fato_auditoria_itens_auditor_modify" ON public.fato_auditoria_itens
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  ) WITH CHECK (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  );

DROP POLICY IF EXISTS "tbl_scores_auditor" ON public.tbl_scores_calculados;
CREATE POLICY "tbl_scores_auditor" ON public.tbl_scores_calculados
  FOR SELECT USING (public.get_user_role() = 'auditor');

DROP POLICY IF EXISTS "tbl_scores_disc_auditor" ON public.tbl_scores_por_disciplina;
CREATE POLICY "tbl_scores_disc_auditor" ON public.tbl_scores_por_disciplina
  FOR SELECT USING (public.get_user_role() = 'auditor');

DROP POLICY IF EXISTS "tbl_scores_cat_auditor" ON public.tbl_scores_por_categoria;
CREATE POLICY "tbl_scores_cat_auditor" ON public.tbl_scores_por_categoria
  FOR SELECT USING (public.get_user_role() = 'auditor');

DROP POLICY IF EXISTS "tbl_evidencias_anexos_auditor" ON public.tbl_evidencias_anexos;
DROP POLICY IF EXISTS "tbl_evidencias_anexos_auditor_select" ON public.tbl_evidencias_anexos;
DROP POLICY IF EXISTS "tbl_evidencias_anexos_auditor_modify" ON public.tbl_evidencias_anexos;
CREATE POLICY "tbl_evidencias_anexos_auditor_select" ON public.tbl_evidencias_anexos
  FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "tbl_evidencias_anexos_auditor_modify" ON public.tbl_evidencias_anexos
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditoria_itens i
      JOIN public.fato_auditorias a ON a.id = i."auditoriaId"
      WHERE i.id = "auditoriaItemId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  ) WITH CHECK (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditoria_itens i
      JOIN public.fato_auditorias a ON a.id = i."auditoriaId"
      WHERE i.id = "auditoriaItemId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  );

DROP POLICY IF EXISTS "tbl_itens_personalizados_auditor" ON public.tbl_itens_personalizados_salvos;
DROP POLICY IF EXISTS "tbl_itens_personalizados_auditor_select" ON public.tbl_itens_personalizados_salvos;
DROP POLICY IF EXISTS "tbl_itens_personalizados_auditor_modify" ON public.tbl_itens_personalizados_salvos;
CREATE POLICY "tbl_itens_personalizados_auditor_select" ON public.tbl_itens_personalizados_salvos
  FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "tbl_itens_personalizados_auditor_modify" ON public.tbl_itens_personalizados_salvos
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditoria_itens i
      JOIN public.fato_auditorias a ON a.id = i."auditoriaId"
      WHERE i.id = "auditoriaItemId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  ) WITH CHECK (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditoria_itens i
      JOIN public.fato_auditorias a ON a.id = i."auditoriaId"
      WHERE i.id = "auditoriaItemId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  );

DROP POLICY IF EXISTS "tbl_relatorios_auditor" ON public.tbl_relatorios_gerados;
DROP POLICY IF EXISTS "tbl_relatorios_auditor_select" ON public.tbl_relatorios_gerados;
DROP POLICY IF EXISTS "tbl_relatorios_auditor_modify" ON public.tbl_relatorios_gerados;
CREATE POLICY "tbl_relatorios_auditor_select" ON public.tbl_relatorios_gerados
  FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "tbl_relatorios_auditor_modify" ON public.tbl_relatorios_gerados
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  ) WITH CHECK (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )
  );

-- ========== 018: Tabela tbl_scores_por_obra ==========
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

ALTER TABLE public.tbl_scores_por_obra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tbl_scores_por_obra_admin" ON public.tbl_scores_por_obra;
DROP POLICY IF EXISTS "tbl_scores_por_obra_auditor" ON public.tbl_scores_por_obra;
DROP POLICY IF EXISTS "tbl_scores_por_obra_visualizador" ON public.tbl_scores_por_obra;
CREATE POLICY "tbl_scores_por_obra_admin" ON public.tbl_scores_por_obra FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_scores_por_obra_auditor" ON public.tbl_scores_por_obra FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "tbl_scores_por_obra_visualizador" ON public.tbl_scores_por_obra FOR SELECT USING (public.get_user_role() = 'visualizador');

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
