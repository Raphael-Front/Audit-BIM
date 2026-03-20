-- Adiciona coluna avatar_url para foto de perfil do usuário
ALTER TABLE public.dim_usuarios
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
