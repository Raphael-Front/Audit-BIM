-- BIM Audit — Enums (PostgreSQL)
-- Aplicar em banco vazio. Ordem: 001 → 011.

CREATE TYPE perfil_usuario AS ENUM ('admin_bim', 'auditor_bim', 'leitor');
CREATE TYPE origem_template AS ENUM ('template_original', 'promovido_de_auditoria');
CREATE TYPE status_auditoria AS ENUM (
  'nao_iniciado',
  'em_andamento',
  'aguardando_apontamentos',
  'concluida',
  'cancelada',
  'pausada'
);
CREATE TYPE tipo_item_auditoria AS ENUM ('template', 'personalizado', 'promovido');
CREATE TYPE status_item_auditoria AS ENUM (
  'nao_iniciado',
  'conforme',
  'nao_conforme',
  'nao_aplicavel',
  'corrigido'
);
CREATE TYPE acao_historico AS ENUM (
  'INSERT',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'FINALIZAR_VERIFICACAO',
  'ADICIONAR_ITEM_PERSONALIZADO',
  'CONCLUIR_AUDITORIA',
  'CANCELAR_AUDITORIA',
  'PAUSAR',
  'RETOMAR'
);
CREATE TYPE tipo_relatorio AS ENUM ('parcial', 'tecnico_standby', 'final');
CREATE TYPE formato_relatorio AS ENUM ('pdf', 'xlsx');
