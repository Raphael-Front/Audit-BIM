-- 026_construflow_deeplink.sql
-- Vínculo profundo (deep link) entre apontamentos do Audit BIM e o Construflow.
--
-- Contexto: a URL de um apontamento no Construflow tem o formato
--   https://app.construflow.com.br/workspace/project/<projectId>/issues?issueId=<issueId>
-- O código legível que o auditor usa no dia a dia (ex.: 6796) NÃO é o mesmo
-- identificador do parâmetro issueId (ex.: 1620463) e não pode ser derivado dele.
-- Por isso guardamos os dois: o código legível continua em `codigoConstruflow`
-- (exibido em relatórios) e o issueId passa a ser guardado para montar o link.
--
-- Ambas as colunas são NULLABLE: nada existente quebra e o preenchimento é gradual.

-- ID do projeto no Construflow (o "1668" da URL). Configurado uma única vez por obra.
ALTER TABLE dim_obras
  ADD COLUMN IF NOT EXISTS "construflowProjectId" VARCHAR(50);

COMMENT ON COLUMN dim_obras."construflowProjectId" IS
  'ID do projeto correspondente no Construflow (segmento /project/<id>/ da URL). Usado para montar o deep link dos apontamentos.';

-- ID interno do apontamento no Construflow (o "issueId=1620463" da URL).
ALTER TABLE fato_auditoria_itens
  ADD COLUMN IF NOT EXISTS "construflowIssueId" VARCHAR(50);

COMMENT ON COLUMN fato_auditoria_itens."construflowIssueId" IS
  'ID interno do apontamento no Construflow (parâmetro issueId da URL). Complementa codigoConstruflow, que guarda o código legível exibido ao usuário.';
