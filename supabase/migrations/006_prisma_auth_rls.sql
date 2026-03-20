-- BIM Audit — Integração Supabase Auth com schema Prisma (dim_*, fato_*, tbl_*)
-- Liga auth.users ao dim_usuarios e configura RLS

-- 1. Vincular dim_usuarios ao Supabase Auth
ALTER TABLE public.dim_usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dim_usuarios_auth_user_id ON public.dim_usuarios(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2. Funções auxiliares para RLS
-- Retorna dim_usuarios.id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_dim_usuario_id()
RETURNS UUID AS $$
  SELECT id FROM public.dim_usuarios WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Mapeia perfil_usuario (admin_bim, auditor_bim, leitor) para role RLS (admin, auditor, visualizador)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT CASE
    WHEN perfil = 'admin_bim' THEN 'admin'
    WHEN perfil = 'auditor_bim' THEN 'auditor'
    ELSE 'visualizador'
  END
  FROM public.dim_usuarios WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Habilitar RLS em todas as tabelas
ALTER TABLE public.dim_obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_checklist_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_template_aplicabilidade_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_auditoria_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_evidencias_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_itens_personalizados_salvos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_historico_alteracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_scores_calculados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_scores_por_disciplina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_scores_por_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_relatorios_gerados ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS — Admin: acesso total
CREATE POLICY "dim_obras_admin" ON public.dim_obras FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "dim_fases_admin" ON public.dim_fases FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "dim_disciplinas_admin" ON public.dim_disciplinas FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "dim_categorias_admin" ON public.dim_categorias FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "dim_usuarios_admin" ON public.dim_usuarios FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_checklist_template_admin" ON public.tbl_checklist_template FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_template_aplicabilidade_admin" ON public.tbl_template_aplicabilidade_fases FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "fato_auditorias_admin" ON public.fato_auditorias FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "fato_auditoria_itens_admin" ON public.fato_auditoria_itens FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_evidencias_anexos_admin" ON public.tbl_evidencias_anexos FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_itens_personalizados_admin" ON public.tbl_itens_personalizados_salvos FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_historico_admin" ON public.tbl_historico_alteracoes FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_scores_calculados_admin" ON public.tbl_scores_calculados FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_scores_por_disciplina_admin" ON public.tbl_scores_por_disciplina FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_scores_por_categoria_admin" ON public.tbl_scores_por_categoria FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "tbl_relatorios_admin" ON public.tbl_relatorios_gerados FOR ALL USING (public.get_user_role() = 'admin');

-- 5. Políticas RLS — Auditor: CRUD em obras; leitura em dims/templates; CRUD em auditorias onde é responsável
CREATE POLICY "dim_obras_auditor" ON public.dim_obras FOR ALL USING (public.get_user_role() = 'auditor');
CREATE POLICY "dim_fases_auditor" ON public.dim_fases FOR ALL USING (public.get_user_role() = 'auditor');
CREATE POLICY "dim_disciplinas_auditor" ON public.dim_disciplinas FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "dim_categorias_auditor" ON public.dim_categorias FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "dim_usuarios_auditor" ON public.dim_usuarios FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "tbl_checklist_template_auditor" ON public.tbl_checklist_template FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "tbl_template_aplicabilidade_auditor" ON public.tbl_template_aplicabilidade_fases FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "fato_auditorias_auditor" ON public.fato_auditorias FOR ALL USING (
  public.get_user_role() = 'auditor' AND "auditorResponsavelId" = public.get_dim_usuario_id()
);
CREATE POLICY "fato_auditoria_itens_auditor" ON public.fato_auditoria_itens FOR ALL USING (
  public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )
);
CREATE POLICY "tbl_evidencias_anexos_auditor" ON public.tbl_evidencias_anexos FOR ALL USING (
  public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditoria_itens i
    JOIN public.fato_auditorias a ON a.id = i."auditoriaId"
    WHERE i.id = "auditoriaItemId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )
);
CREATE POLICY "tbl_itens_personalizados_auditor" ON public.tbl_itens_personalizados_salvos FOR ALL USING (
  public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditoria_itens i
    JOIN public.fato_auditorias a ON a.id = i."auditoriaId"
    WHERE i.id = "auditoriaItemId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )
);
CREATE POLICY "tbl_historico_auditor" ON public.tbl_historico_alteracoes FOR ALL USING (
  public.get_user_role() = 'auditor' AND "usuarioId" = public.get_dim_usuario_id()
);
CREATE POLICY "tbl_scores_auditor" ON public.tbl_scores_calculados FOR SELECT USING (
  public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )
);
CREATE POLICY "tbl_scores_disc_auditor" ON public.tbl_scores_por_disciplina FOR SELECT USING (
  public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )
);
CREATE POLICY "tbl_scores_cat_auditor" ON public.tbl_scores_por_categoria FOR SELECT USING (
  public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )
);
CREATE POLICY "tbl_relatorios_auditor" ON public.tbl_relatorios_gerados FOR ALL USING (
  public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    WHERE a.id = "auditoriaId" AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )
);

-- 6. Políticas RLS — Visualizador (leitor): apenas SELECT
CREATE POLICY "dim_obras_visualizador" ON public.dim_obras FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "dim_fases_visualizador" ON public.dim_fases FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "dim_disciplinas_visualizador" ON public.dim_disciplinas FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "dim_categorias_visualizador" ON public.dim_categorias FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "dim_usuarios_visualizador" ON public.dim_usuarios FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_checklist_template_visualizador" ON public.tbl_checklist_template FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_template_aplicabilidade_visualizador" ON public.tbl_template_aplicabilidade_fases FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "fato_auditorias_visualizador" ON public.fato_auditorias FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "fato_auditoria_itens_visualizador" ON public.fato_auditoria_itens FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_evidencias_anexos_visualizador" ON public.tbl_evidencias_anexos FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_itens_personalizados_visualizador" ON public.tbl_itens_personalizados_salvos FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_historico_visualizador" ON public.tbl_historico_alteracoes FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_scores_calculados_visualizador" ON public.tbl_scores_calculados FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_scores_por_disciplina_visualizador" ON public.tbl_scores_por_disciplina FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_scores_por_categoria_visualizador" ON public.tbl_scores_por_categoria FOR SELECT USING (public.get_user_role() = 'visualizador');
CREATE POLICY "tbl_relatorios_visualizador" ON public.tbl_relatorios_gerados FOR SELECT USING (public.get_user_role() = 'visualizador');

-- 7. Serviço anon precisa de bypass para service_role; RLS se aplica a roles authenticated
-- Usuários sem dim_usuario vinculado: get_user_role() retorna NULL -> nenhuma policy match
-- Permitir SELECT em dim_usuarios para o próprio auth_user_id (para o usuário ver seu perfil)
CREATE POLICY "dim_usuarios_own" ON public.dim_usuarios FOR SELECT USING (auth_user_id = auth.uid());
