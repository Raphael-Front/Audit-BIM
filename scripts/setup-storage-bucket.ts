/**
 * Script para criar o bucket audit-evidencias no Supabase Storage.
 * Execute: npm run setup-storage
 * Requer DATABASE_URL no .env
 */
import "dotenv/config";
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida no .env");
  process.exit(1);
}

const sql = `
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audit-evidencias', 'audit-evidencias', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "audit_evidencias_select" ON storage.objects;
CREATE POLICY "audit_evidencias_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'audit-evidencias' AND (
  public.get_user_role() = 'admin' OR
  (public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
    WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  )) OR public.get_user_role() = 'visualizador'
));

DROP POLICY IF EXISTS "audit_evidencias_insert" ON storage.objects;
CREATE POLICY "audit_evidencias_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'audit-evidencias' AND (
  public.get_user_role() = 'admin' OR
  (public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
    WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  ))
));

DROP POLICY IF EXISTS "audit_evidencias_update" ON storage.objects;
CREATE POLICY "audit_evidencias_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'audit-evidencias' AND (
  public.get_user_role() = 'admin' OR
  (public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
    WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  ))
));

DROP POLICY IF EXISTS "audit_evidencias_delete" ON storage.objects;
CREATE POLICY "audit_evidencias_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'audit-evidencias' AND (
  public.get_user_role() = 'admin' OR
  (public.get_user_role() = 'auditor' AND EXISTS (
    SELECT 1 FROM public.fato_auditorias a
    JOIN public.fato_auditoria_itens i ON i."auditoriaId" = a.id
    WHERE i.id::text = (storage.foldername(name))[1] AND a."auditorResponsavelId" = public.get_dim_usuario_id()
  ))
));
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query(sql);
    console.log("✅ Bucket audit-evidencias e políticas criados com sucesso!");
  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
