-- Remove a FK de auth_user_id para permitir importar CSV com dados do banco antigo
-- Os auth_user_id do projeto antigo não existem em auth.users do novo projeto
ALTER TABLE public.dim_usuarios
  DROP CONSTRAINT IF EXISTS dim_usuarios_auth_user_id_fkey;
