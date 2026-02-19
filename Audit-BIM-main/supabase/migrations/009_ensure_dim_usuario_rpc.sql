-- Função RPC para garantir que dim_usuarios existe para um usuário do Supabase Auth
-- Idempotente: pode ser chamada múltiplas vezes sem problemas

-- Remover função existente se houver (pode ter tipo de retorno ou parâmetros diferentes)
DROP FUNCTION IF EXISTS public.ensure_dim_usuario() CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_dim_usuario()
RETURNS void AS $$
DECLARE
  v_auth_user_id UUID;
  v_email TEXT;
  v_nome TEXT;
  v_dim_user_id UUID;
BEGIN
  -- Obter o ID do usuário autenticado
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar dados do usuário no Supabase Auth
  SELECT 
    u.email,
    COALESCE(
      u.raw_user_meta_data->>'nome',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1)
    ) INTO v_email, v_nome
  FROM auth.users u
  WHERE u.id = v_auth_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado no Supabase Auth';
  END IF;

  -- Verificar se já existe dim_usuario para este auth_user_id
  SELECT id INTO v_dim_user_id
  FROM public.dim_usuarios
  WHERE auth_user_id = v_auth_user_id;

  IF v_dim_user_id IS NOT NULL THEN
    -- Atualizar dados existentes
    UPDATE public.dim_usuarios
    SET 
      email = v_email,
      "nomeCompleto" = COALESCE("nomeCompleto", v_nome),
      "updatedAt" = NOW(),
      "ultimoAcesso" = NOW()
    WHERE id = v_dim_user_id;
  ELSE
    -- Criar novo registro
    INSERT INTO public.dim_usuarios (
      id,
      email,
      "nomeCompleto",
      auth_user_id,
      perfil,
      ativo,
      "createdAt",
      "updatedAt",
      "ultimoAcesso"
    )
    VALUES (
      gen_random_uuid(),
      v_email,
      v_nome,
      v_auth_user_id,
      'auditor_bim', -- Perfil padrão
      true,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      "nomeCompleto" = COALESCE(EXCLUDED."nomeCompleto", dim_usuarios."nomeCompleto"),
      "updatedAt" = NOW(),
      "ultimoAcesso" = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário: Esta função deve ser chamada após o login/signup do usuário
-- para garantir que existe um registro em dim_usuarios vinculado ao auth.users

