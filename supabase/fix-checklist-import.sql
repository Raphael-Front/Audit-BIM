-- Remove a FK de inativadoPorId para permitir importar CSV
-- inativadoPorId pode referenciar usuários do banco antigo que não foram migrados
ALTER TABLE public.tbl_checklist_template
  DROP CONSTRAINT IF EXISTS tbl_checklist_template_inativadoPorId_fkey;
