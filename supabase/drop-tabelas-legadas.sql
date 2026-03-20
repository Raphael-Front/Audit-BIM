-- Remove tabelas legadas/antigas, mantendo apenas as do schema principal
-- Ordem respeitando FKs (ou CASCADE)

DROP TABLE IF EXISTS public.auditoria_itens CASCADE;
DROP TABLE IF EXISTS public.auditoria_logs CASCADE;
DROP TABLE IF EXISTS public.auditorias CASCADE;
DROP TABLE IF EXISTS public.template_itens CASCADE;
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.obras CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.dim_categoria_disciplinas CASCADE;
