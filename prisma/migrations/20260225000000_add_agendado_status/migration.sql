-- Add 'agendado' value to status_auditoria enum
ALTER TYPE "status_auditoria" ADD VALUE IF NOT EXISTS 'agendado';
