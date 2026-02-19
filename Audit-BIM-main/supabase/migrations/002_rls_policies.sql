-- Row Level Security (RLS) para BIM Audit
-- Roles: admin (acesso total), auditor (criar/editar suas auditorias), visualizador (leitura)

-- Habilitar RLS em todas as tabelas
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_logs ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: retorna role do usuário atual a partir de user_profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE((SELECT role FROM public.user_profiles WHERE id = auth.uid()), 'visualizador')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin: acesso total
CREATE POLICY obras_admin_all ON obras
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY templates_admin_all ON templates
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY template_itens_admin_all ON template_itens
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY user_profiles_admin_all ON user_profiles
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY auditorias_admin_all ON auditorias
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY auditoria_itens_admin_all ON auditoria_itens
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY auditoria_logs_admin_all ON auditoria_logs
  FOR ALL USING (public.get_user_role() = 'admin');

-- Auditor: leitura em obras, templates, template_itens; leitura/inserção em user_profiles (próprio perfil); auditorias onde é responsável ou criador; itens dessas auditorias; logs
CREATE POLICY obras_auditor_select ON obras
  FOR SELECT USING (public.get_user_role() = 'auditor');

CREATE POLICY templates_auditor_select ON templates
  FOR SELECT USING (public.get_user_role() = 'auditor');

CREATE POLICY template_itens_auditor_select ON template_itens
  FOR SELECT USING (public.get_user_role() = 'auditor');

CREATE POLICY user_profiles_auditor_own ON user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY auditorias_auditor_own ON auditorias
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND (
      auditor_responsavel = auth.uid()
    )
  );

CREATE POLICY auditoria_itens_auditor_own ON auditoria_itens
  FOR ALL USING (
    public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM auditorias a
      WHERE a.id = auditoria_itens.auditoria_id AND a.auditor_responsavel = auth.uid()
    )
  );

CREATE POLICY auditoria_logs_auditor_select ON auditoria_logs
  FOR SELECT USING (
    public.get_user_role() = 'auditor' AND (
      usuario_id = auth.uid() OR EXISTS (
        SELECT 1 FROM auditorias a
        WHERE a.id = auditoria_logs.auditoria_id AND a.auditor_responsavel = auth.uid()
      )
    )
  );

CREATE POLICY auditoria_logs_auditor_insert ON auditoria_logs
  FOR INSERT WITH CHECK (public.get_user_role() = 'auditor' AND usuario_id = auth.uid());

-- Visualizador: apenas SELECT em tudo (exceto user_profiles: só próprio)
CREATE POLICY obras_visualizador_select ON obras
  FOR SELECT USING (public.get_user_role() = 'visualizador');

CREATE POLICY templates_visualizador_select ON templates
  FOR SELECT USING (public.get_user_role() = 'visualizador');

CREATE POLICY template_itens_visualizador_select ON template_itens
  FOR SELECT USING (public.get_user_role() = 'visualizador');

CREATE POLICY user_profiles_visualizador_own ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY auditorias_visualizador_select ON auditorias
  FOR SELECT USING (public.get_user_role() = 'visualizador');

CREATE POLICY auditoria_itens_visualizador_select ON auditoria_itens
  FOR SELECT USING (public.get_user_role() = 'visualizador');

CREATE POLICY auditoria_logs_visualizador_select ON auditoria_logs
  FOR SELECT USING (public.get_user_role() = 'visualizador');
