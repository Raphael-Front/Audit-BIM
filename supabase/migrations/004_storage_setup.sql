-- Storage: bucket para evidências de auditoria
-- Estrutura: /obras/{obra_id}/auditorias/{auditoria_id}/evidencias/
-- Formatos: JPG, PNG, PDF

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

-- Políticas: usuários autenticados com role auditor ou admin podem ler/escrever em paths da sua auditoria
CREATE POLICY "audit_evidencias_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM auditorias a
      WHERE a.auditor_responsavel = auth.uid()
        AND (storage.foldername(name))[1] = a.obra_id::text
        AND (storage.foldername(name))[3] = a.id::text
    )) OR
    public.get_user_role() = 'visualizador'
  )
);

CREATE POLICY "audit_evidencias_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM auditorias a
      WHERE a.auditor_responsavel = auth.uid()
        AND (storage.foldername(name))[1] = a.obra_id::text
        AND (storage.foldername(name))[3] = a.id::text
    ))
  )
);

CREATE POLICY "audit_evidencias_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM auditorias a
      WHERE a.auditor_responsavel = auth.uid()
        AND (storage.foldername(name))[1] = a.obra_id::text
        AND (storage.foldername(name))[3] = a.id::text
    ))
  )
);

CREATE POLICY "audit_evidencias_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audit-evidencias' AND (
    public.get_user_role() = 'admin' OR
    (public.get_user_role() = 'auditor' AND EXISTS (
      SELECT 1 FROM auditorias a
      WHERE a.auditor_responsavel = auth.uid()
        AND (storage.foldername(name))[1] = a.obra_id::text
        AND (storage.foldername(name))[3] = a.id::text
    ))
  )
);
