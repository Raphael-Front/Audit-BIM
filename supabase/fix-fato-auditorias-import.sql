-- Execute isto PRIMEIRO no Supabase SQL Editor, depois rode o INSERT de fato_auditorias
ALTER TABLE public.fato_auditorias DROP CONSTRAINT IF EXISTS fato_auditorias_canceladoPorId_fkey;
ALTER TABLE public.fato_auditorias DROP CONSTRAINT IF EXISTS fato_auditorias_auditorResponsavelId_fkey;
