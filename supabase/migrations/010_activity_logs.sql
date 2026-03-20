-- BIM Audit — Tabela de Activity Log (Log de Atividades)
-- Acessível apenas para administradores

CREATE TABLE IF NOT EXISTS public.tbl_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.dim_usuarios(id) ON DELETE SET NULL,
  user_name VARCHAR(200),
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id UUID,
  entity_name VARCHAR(500),
  details TEXT,
  previous_value JSONB,
  new_value JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.tbl_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.tbl_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.tbl_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.tbl_activity_logs(entity);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id ON public.tbl_activity_logs(entity_id);

-- RLS: Apenas admin pode ler logs
ALTER TABLE public.tbl_activity_logs ENABLE ROW LEVEL SECURITY;

-- Inserção: qualquer usuário autenticado pode inserir (para logar suas próprias ações)
CREATE POLICY "tbl_activity_logs_insert" ON public.tbl_activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Leitura: apenas admin
CREATE POLICY "tbl_activity_logs_admin_select" ON public.tbl_activity_logs
  FOR SELECT USING (public.get_user_role() = 'admin');

-- Nenhuma política de UPDATE ou DELETE (logs são imutáveis)
-- Não permitir UPDATE/DELETE para usuários comuns
COMMENT ON TABLE public.tbl_activity_logs IS 'Log de atividades do sistema BIM Audit - visível apenas para administradores';
