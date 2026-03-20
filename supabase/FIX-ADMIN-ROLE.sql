-- ============================================
-- SCRIPT PARA CORRIGIR PERFIL DE ADMIN
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. Verificar usuários existentes
SELECT 
  u.id as auth_id,
  u.email,
  d.id as dim_id,
  d."nomeCompleto",
  d.perfil,
  d."auth_user_id"
FROM auth.users u
LEFT JOIN dim_usuarios d ON d."auth_user_id" = u.id
ORDER BY u.email;

-- 2. Criar/atualizar registro para TODOS os usuários autenticados
-- (Execute a função ensure_dim_usuario para cada usuário)
-- NOTA: Esta função só funciona quando executada pelo próprio usuário autenticado
-- Para fazer em lote, veja o passo 3

-- 3. Tornar TODOS os usuários existentes como admin (TEMPORÁRIO - ajuste depois)
UPDATE dim_usuarios 
SET perfil = 'admin_bim'
WHERE perfil != 'admin_bim';

-- 4. Verificar resultado
SELECT 
  email,
  "nomeCompleto",
  perfil,
  "auth_user_id"
FROM dim_usuarios
ORDER BY email;

-- ============================================
-- SOLUÇÃO ALTERNATIVA: Para um usuário específico
-- ============================================

-- Substitua 'SEU-EMAIL@exemplo.com' pelo seu email:

-- A) Verificar se existe
SELECT * FROM dim_usuarios WHERE email = 'SEU-EMAIL@exemplo.com';

-- B) Se não existir, criar:
INSERT INTO dim_usuarios (id, email, "nomeCompleto", "auth_user_id", perfil, ativo, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.id,
  'admin_bim',
  true,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'SEU-EMAIL@exemplo.com'
  AND NOT EXISTS (SELECT 1 FROM dim_usuarios d WHERE d.email = u.email)
ON CONFLICT (email) DO UPDATE SET
  perfil = 'admin_bim',
  "auth_user_id" = EXCLUDED."auth_user_id",
  "updatedAt" = NOW();

-- C) Se já existir, apenas atualizar perfil:
UPDATE dim_usuarios 
SET perfil = 'admin_bim',
    "updatedAt" = NOW()
WHERE email = 'SEU-EMAIL@exemplo.com';

