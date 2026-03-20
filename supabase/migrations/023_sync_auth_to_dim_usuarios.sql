-- Sincroniza auth.users → dim_usuarios automaticamente
-- Resolve: usuários criados no Supabase Auth (signup ou admin) não apareciam em dim_usuarios
-- Perfil padrão: leitor (auditor só vê auditorias onde é responsável; leitor vê tudo em leitura)

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
    id,
    email,
    "nomeCompleto",
    "senhaHash",
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
    '',
    NEW.id,
    'leitor',
    true,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    "nomeCompleto" = COALESCE(EXCLUDED."nomeCompleto", public.dim_usuarios."nomeCompleto"),
    "updatedAt" = NOW(),
    "ultimoAcesso" = NOW();

  RETURN NEW;
END;
$$;

-- Atualizar ensure_dim_usuario para usar leitor como perfil padrão (fallback quando trigger não existia)
CREATE OR REPLACE FUNCTION public.ensure_dim_usuario()
RETURNS void AS $$
DECLARE
  v_auth_user_id UUID;
  v_email TEXT;
  v_nome TEXT;
  v_dim_user_id UUID;
BEGIN
  v_auth_user_id := auth.uid();
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT u.email, COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
  INTO v_email, v_nome
  FROM auth.users u WHERE u.id = v_auth_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado no Supabase Auth';
  END IF;

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
      "nomeCompleto" = COALESCE(EXCLUDED."nomeCompleto", dim_usuarios."nomeCompleto"),
      "updatedAt" = NOW(),
      "ultimoAcesso" = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();
