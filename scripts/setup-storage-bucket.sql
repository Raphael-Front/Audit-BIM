-- Execute este SQL no Supabase Dashboard: SQL Editor
-- https://supabase.com/dashboard/project/SEU_PROJETO/sql/new

-- 1. Criar bucket para evidências
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audit-evidencias',
  'audit-evidencias',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Políticas de acesso
DROP POLICY IF EXISTS "audit_evidencias_select" ON storage.objects;
CREATE POLICY "audit_evidencias_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
      WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    )) OR
    public.get_user_role() = 'visualizador'
  )
);

DROP POLICY IF EXISTS "audit_evidencias_insert" ON storage.objects;
CREATE POLICY "audit_evidencias_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
      WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    ))
  )
);

DROP POLICY IF EXISTS "audit_evidencias_update" ON storage.objects;
CREATE POLICY "audit_evidencias_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
      WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    ))
  )
);

DROP POLICY IF EXISTS "audit_evidencias_delete" ON storage.objects;
CREATE POLICY "audit_evidencias_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM public.fato_auditorias a
      JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
      WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
    ))
  )
);
