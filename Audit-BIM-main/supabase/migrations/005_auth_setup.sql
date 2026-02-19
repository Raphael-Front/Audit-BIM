-- Supabase Auth: sincronizar user_profiles com auth.users
-- Cria perfil ao inserir em auth.users (signup ou admin createUser)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, nome, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'auditor'),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, public.user_profiles.nome),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no auth.users (Supabase expõe isso via pg_catalog ou auth schema)
-- Em projetos Supabase, use Database Webhooks ou Edge Function para "on auth user created"
-- pois auth.users fica no schema auth gerenciado pelo Supabase.
-- Alternativa: chamar handle_new_user a partir de uma Edge Function após signup.
-- Para migração manual, garantimos que user_profiles existe; o script migrate-users preenche.

-- Comentário: Se o projeto tiver acesso ao trigger em auth.users:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Função chamável pela Edge Function ou pelo client após signup (idempotente)
CREATE OR REPLACE FUNCTION public.ensure_user_profile(p_user_id UUID DEFAULT auth.uid())
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_profiles (id, nome, role, active)
  SELECT
    p_user_id,
    COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'role', 'auditor'),
    true
  FROM auth.users u WHERE u.id = p_user_id
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
