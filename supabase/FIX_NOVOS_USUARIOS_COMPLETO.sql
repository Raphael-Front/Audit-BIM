-- =============================================================================
-- CORREÇÃO COMPLETA: Novos usuários como LEITOR e visibilidade dos dados
-- Execute este script no SQL Editor do Supabase (copie e cole tudo)
--
-- Depois de executar: faça LOGOUT e LOGIN novamente no site para ver os dados.
-- =============================================================================

-- 1. Função que cria dim_usuarios ao inserir em auth.users (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
  v_nome TEXT;
BEGIN
  v_email := COALESCE(NEW.email, 'pending-' || NEW.id::text);
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'name',
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.dim_usuarios (
    id, email, "nomeCompleto", "senhaHash", auth_user_id, perfil, ativo,
    "createdAt", "updatedAt", "ultimoAcesso"
  )
  VALUES (
    gen_random_uuid(), v_email, v_nome, '', NEW.id, 'leitor', true,
    NOW(), NOW(), NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    "nomeCompleto" = COALESCE(EXCLUDED."nomeCompleto", public.dim_usuarios."nomeCompleto"),
    perfil = 'leitor',
    "updatedAt" = NOW(),
    "ultimoAcesso" = NOW();

  RETURN NEW;
END;
$$;

-- 2. Trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

-- 3. RPC ensure_dim_usuario (perfil LEITOR, com senhaHash)
CREATE OR REPLACE FUNCTION public.ensure_dim_usuario()
RETURNS void AS $$
DECLARE
  v_auth_user_id UUID;
  v_email TEXT;
  v_nome TEXT;
  v_dim_user_id UUID;
BEGIN
  v_auth_user_id := auth.uid();
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT u.email, COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
  INTO v_email, v_nome
  FROM auth.users u WHERE u.id = v_auth_user_id;

  IF v_email IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado no Supabase Auth'; END IF;

  SELECT id INTO v_dim_user_id FROM public.dim_usuarios WHERE auth_user_id = v_auth_user_id;

  IF v_dim_user_id IS NOT NULL THEN
    UPDATE public.dim_usuarios
    SET email = v_email, "nomeCompleto" = COALESCE("nomeCompleto", v_nome), "updatedAt" = NOW(), "ultimoAcesso" = NOW()
    WHERE id = v_dim_user_id;
  ELSE
    INSERT INTO public.dim_usuarios (id, email, "nomeCompleto", "senhaHash", auth_user_id, perfil, ativo, "createdAt", "updatedAt", "ultimoAcesso")
    VALUES (gen_random_uuid(), v_email, v_nome, '', v_auth_user_id, 'leitor', true, NOW(), NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    "nomeCompleto" = COALESCE(EXCLUDED."nomeCompleto", public.dim_usuarios."nomeCompleto"),
    perfil = 'leitor',
    "updatedAt" = NOW(),
    "ultimoAcesso" = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. Sincronizar TODOS os usuários de auth.users para dim_usuarios (incluindo o que você acabou de criar)
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
  perfil = 'leitor',
  "updatedAt" = NOW(),
  "ultimoAcesso" = NOW();

