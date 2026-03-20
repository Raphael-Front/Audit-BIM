-- Insere o usuário admin@bim.local em dim_usuarios
-- Execute no Supabase SQL Editor (ou via psql)
-- Senha: admin123

INSERT INTO public.dim_usuarios (id, email, "nomeCompleto", "senhaHash", perfil, ativo, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@bim.local',
  'Administrador BIM',
  '$2b$10$cbFMQjWQNPEWKsZMYSL/l.VO8J9C5d8zy0sYuWPVtodi5lZ0FfwMC',
  'admin_bim',
  true,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE SET
  "nomeCompleto" = EXCLUDED."nomeCompleto",
  "senhaHash" = EXCLUDED."senhaHash",
  perfil = EXCLUDED.perfil,
  ativo = EXCLUDED.ativo,
  "updatedAt" = now();
