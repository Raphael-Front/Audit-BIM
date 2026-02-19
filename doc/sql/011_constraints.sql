-- BIM Audit — Constraints adicionais (FK adiada e checks)
-- Depende: 003_biblioteca.sql, 004_fatos.sql

-- FK de tbl_checklist_template.auditoria_origem_id → fato_auditorias (criada após fato_auditorias existir)
ALTER TABLE tbl_checklist_template
  ADD CONSTRAINT fk_template_auditoria_origem
  FOREIGN KEY (auditoria_origem_id) REFERENCES fato_auditorias(id) ON DELETE SET NULL;
