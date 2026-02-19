# Scripts de importação (planilha → sistema Prisma/PostgreSQL)

Importação única dos dados existentes da planilha para o banco atual (Prisma). Após a importação, o sistema passa a ser a única fonte de verdade.

## Pré-requisitos

- `DATABASE_URL` no ambiente ou no `.env` da **raiz do projeto** (o script usa o mesmo `.env` do app).
- Banco rodando (local ou Docker). Se usar Docker: `npm run docker:up` na raiz e, se precisar, `npm run docker:migrate`.
- Cliente Prisma gerado **na raiz** antes da primeira importação: `npm run db:generate` (o script de import usa o client do pacote `@bim-audit/db`).

## Importação da planilha

1. Copie `import-config.example.json` para `import-config.json` (se ainda não tiver).
2. Ajuste os nomes das colunas em `singleSheet.columns` ou `sheets.*.columns` conforme os cabeçalhos da sua planilha.
3. Execute a partir da pasta **scripts** (para que `import-config.json` seja encontrado):
   ```bash
   cd scripts
   npm install
   npm run import -- ../BD-AUDITORIA-BIM.xlsx
   ```
   Se a planilha estiver em outro lugar:
   ```bash
   npm run import -- "C:\caminho\para\planilha.xlsx"
   ```
4. Verifique o log gerado (`import-log-YYYYMMDD-HHmmss.txt`):
   - Quantidade inserida por entidade
   - Linhas com erro (número da linha + mensagem)
   - Resumo ao final

## Ordem de importação (respeita FKs)

User → Work → Phase → Discipline → Category → AuditPhase → ChecklistItem → Audit → AuditItem.

Cada etapa só roda se a entidade estiver no config e houver dados na aba correspondente.

## Validações no script

- Campos obrigatórios por entidade.
- FKs resolvíveis (obra por código, usuário por email, disciplina por nome, etc.).
- Duplicidade: com `onDuplicate: "skip"` no config, User (email), Work (código), Discipline (nome), AuditPhase (name) são pulados se já existirem.

## Documentação do mapeamento

Veja [MAPEAMENTO-PLANILHA.md](MAPEAMENTO-PLANILHA.md) para o mapeamento coluna → tabela e regras de duplicidade.

## Outros scripts

- **validate-imported-data.ts** — validação pós-importação para **Supabase** (outro fluxo). Para validar dados importados via Prisma, use o próprio app ou consultas ao banco.
- **migrate-users.ts** — migração de usuários para **Supabase Auth** (fluxo Supabase).
