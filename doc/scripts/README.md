# Scripts de importação (planilha → sistema Prisma/PostgreSQL)

Importação única dos dados existentes da planilha para o banco atual (Prisma). Após a importação, o sistema passa a ser a única fonte de verdade.

## Pré-requisitos

- `DATABASE_URL` no ambiente ou no `.env` da **raiz do projeto** (o script usa o mesmo `.env` do app).
- Banco rodando (local ou Supabase).
- Cliente Prisma gerado **na raiz** antes da primeira importação: `npm run db:generate`.

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

Veja [mapeamento-planilha.md](../dados/mapeamento-planilha.md) para o mapeamento coluna → tabela e regras de duplicidade.

## Importação direta via SQL (evitar limite do Supabase SQL Editor)

Se a importação via planilha/API estourar a memória do Supabase, use o import via conexão direta ou em chunks no SQL Editor:

### Opção 1: Import via conexão direta (recomendado)

Executa os SQLs diretamente no banco, sem passar pelo SQL Editor web:

```bash
npm run db:import-auditoria-sql
```

Requer `DATABASE_URL` no `.env` e os arquivos gerados em `supabase/`:
- `fato_auditorias_insert.sql`
- `fato_auditoria_itens_insert.sql`

Ou as versões em chunks (veja opção 2).

### Opção 2: SQL Editor em chunks

Gere arquivos menores para rodar um por vez no SQL Editor:

```bash
# Gerar em lotes de 50 linhas
npm run db:csv-to-sql-fato-auditorias -- --chunks=50
npm run db:csv-to-sql-fato-itens -- --chunks=50
```

Saída: `fato_auditorias_insert_01.sql`, `fato_auditorias_insert_02.sql`, etc. Execute cada arquivo no SQL Editor, na ordem.

### Gerar SQL a partir do CSV

Se você tiver os CSVs exportados (`fato_auditorias_rows.csv`, `fato_auditoria_itens_rows.csv` na raiz):

```bash
npm run db:csv-to-sql-fato-auditorias    # gera fato_auditorias_insert.sql
npm run db:csv-to-sql-fato-itens         # gera fato_auditoria_itens_insert.sql
```

Com chunks: `--chunks=50` (ou outro número).

## Deduplicação da biblioteca

Após várias importações, a biblioteca pode ter categorias e itens duplicados. Para remover sem prejudicar auditorias existentes:

1. **Pré-visualizar** o que seria alterado (somente leitura):
   ```sql
   -- Execute supabase/deduplicate-library-preview.sql no Supabase SQL Editor
   ```

2. **Executar** a deduplicação:
   ```sql
   -- Execute supabase/deduplicate-library.sql no Supabase SQL Editor
   ```

Critérios de duplicidade:
- **Categorias**: mesmo nome (ignorando maiúsculas/espaços) → mantém a mais antiga.
- **Itens da biblioteca**: mesma (disciplina, categoria, texto de verificação) → mantém o mais antigo.

Referências em auditorias, anexos e itens personalizados são redirecionadas para o registro mantido.

## Outros scripts

- **validate-imported-data.ts** — validação pós-importação para **Supabase** (outro fluxo). Para validar dados importados via Prisma, use o próprio app ou consultas ao banco.
- **migrate-users.ts** — migração de usuários para **Supabase Auth** (fluxo Supabase).
