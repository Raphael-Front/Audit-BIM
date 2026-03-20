-- Sincroniza usuários de auth.users para dim_usuarios (usuários que já existem no Auth mas não na tabela)
-- Execute no SQL Editor do Supabase APÓS aplicar a migration 023
-- Perfil padrão: leitor

INSERT INTO public.dim_usuarios (id, email, "nomeCompleto", "senhaHash", auth_user_id, perfil, ativo, "createdAt", "updatedAt", "ultimoAcesso")
SELECT
  gen_random_uuid(),
  COALESCE(u.email, 'pending-' || u.id::text),
  COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', split_part(COALESCE(u.email, 'pending'), '@', 1)),
  '',
  u.id,
  'leitor',
  true,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.dim_usuarios d WHERE d.auth_user_id = u.id)
ON CONFLICT (email) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  "nomeCompleto" = COALESCE(EXCLUDED."nomeCompleto", public.dim_usuarios."nomeCompleto"),
  "updatedAt" = NOW(),
  "ultimoAcesso" = NOW();
