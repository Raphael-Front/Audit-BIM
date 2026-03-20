-- Limpa raw_user_meta_data inchado em auth.users para reduzir tamanho do token
-- (evita QuotaExceededError e refresh_token de 17+ MB)
-- Mantém apenas campos necessários: nome, name, perfil

UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'nome', COALESCE(raw_user_meta_data->>'nome', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  'name', COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'nome', split_part(email, '@', 1)),
  'perfil', COALESCE(raw_user_meta_data->>'perfil', 'leitor')
)
WHERE length(raw_user_meta_data::text) > 1000;
