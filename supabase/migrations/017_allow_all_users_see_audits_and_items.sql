-- Permite que todos os usuários (admin, auditor, visualizador) visualizem
-- auditorias, itens e contagens, independente de ser o auditor responsável.

-- 1. fato_auditorias: auditores podem VER todas, mas só EDITAR as suas
DROP POLICY IF EXISTS "fato_auditorias_auditor" ON public.fato_auditorias;
CREATE POLICY "fato_auditorias_auditor_select" ON public.fato_auditorias
  FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "fato_auditorias_auditor_modify" ON public.fato_auditorias
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND "auditorResponsavelId" = public.get_dim_usuario_id()
  ) WITH CHECK (
    public.get_user_role() = 'auditor' AND "auditorResponsavelId" = public.get_dim_usuario_id()
  );

-- 2. fato_auditoria_itens: auditores podem VER todos os itens, mas só EDITAR os das suas auditorias
DROP POLICY IF EXISTS "fato_auditoria_itens_auditor" ON public.fato_auditoria_itens;
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

-- 3. tbl_scores_calculados: auditores podem ver todos os scores (só leitura)
DROP POLICY IF EXISTS "tbl_scores_auditor" ON public.tbl_scores_calculados;
CREATE POLICY "tbl_scores_auditor" ON public.tbl_scores_calculados
  FOR SELECT USING (public.get_user_role() = 'auditor');

-- 4. tbl_scores_por_disciplina: auditores podem ver todos
DROP POLICY IF EXISTS "tbl_scores_disc_auditor" ON public.tbl_scores_por_disciplina;
CREATE POLICY "tbl_scores_disc_auditor" ON public.tbl_scores_por_disciplina
  FOR SELECT USING (public.get_user_role() = 'auditor');

-- 5. tbl_scores_por_categoria: auditores podem ver todos
DROP POLICY IF EXISTS "tbl_scores_cat_auditor" ON public.tbl_scores_por_categoria;
CREATE POLICY "tbl_scores_cat_auditor" ON public.tbl_scores_por_categoria
  FOR SELECT USING (public.get_user_role() = 'auditor');

-- 6. tbl_evidencias_anexos: auditores podem VER todas as evidências
DROP POLICY IF EXISTS "tbl_evidencias_anexos_auditor" ON public.tbl_evidencias_anexos;
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

-- 7. tbl_itens_personalizados_salvos: auditores podem VER todos
DROP POLICY IF EXISTS "tbl_itens_personalizados_auditor" ON public.tbl_itens_personalizados_salvos;
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

-- 8. tbl_relatorios_gerados: auditores podem VER todos os relatórios
DROP POLICY IF EXISTS "tbl_relatorios_auditor" ON public.tbl_relatorios_gerados;
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
