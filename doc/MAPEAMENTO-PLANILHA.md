# Mapeamento Planilha → Sistema (Prisma / Banco atual)

Este documento descreve o mapeamento das colunas da planilha para as tabelas do sistema (Work, Phase, Discipline, Category, AuditPhase, ChecklistItem, Audit, AuditItem, etc.). Após a importação, o sistema passa a ser a única fonte de verdade.

## Modo singleSheet (uma aba só)

Se a sua planilha tem **uma única aba** com as colunas:

- **Disciplina**, **Categoria**, **Itens de verificação**, **Status**, **Evidência/Observação**, **CF**, **Proxima revisão**, **Peso**, **Pontos**, **Obra**, **Fase**

configure no `import-config.json`:

- `singleSheet.enabled: true`
- `singleSheet.columns` com o mapeamento exato dos cabeçalhos (veja `import-config.example.json`)
- `singleSheet.defaultPhaseName`: nome da fase de obra criada por obra (ex.: `"Geral"`)
- `singleSheet.defaultAuditorEmail`: email de um usuário **já existente no banco** para ser usado como auditor/criador de todas as auditorias

O script deriva automaticamente: Obras (Obra), Fases de auditoria (Fase), Disciplinas, Categorias, itens de checklist, uma auditoria por (Obra + Fase + Disciplina) e um item de auditoria por linha.

### Regra de identificação de auditorias (Obra + Fase + Disciplina)

A **auditoria** é identificada pela combinação de 3 campos: **Obra**, **Fase** e **Disciplina**. Quando qualquer um desses 3 muda, é uma **nova auditoria**. Na planilha, essas colunas nem sempre estão preenchidas em todas as linhas (há blocos visuais); o script aplica *propagação* (fill-down): células vazias herdam o último valor conhecido. Ex.: linhas 2–19 com R15RV/PR na primeira linha e vazias abaixo pertencem à mesma auditoria; na linha 20, se Obra mudar para R4A ou Fase para PB, inicia nova auditoria.

## Formato esperado da planilha (várias abas)

- **Excel:** arquivo `.xlsx` com uma aba por entidade (Usuários, Obras, Fases, Disciplinas, Categorias, Fases Auditoria, Itens Checklist, Auditorias, Itens Auditoria).
- **CSV:** um arquivo por aba, ou um único CSV; o script pode ser ajustado para ler múltiplos CSVs (um por entidade).
- Copie `import-config.example.json` para `import-config.json` e ajuste os nomes das colunas em `sheets.*.columns` conforme os cabeçalhos da sua planilha.

## Ordem de importação (respeita FKs)

1. **User** — auditores/usuários  
2. **Work** — obras  
3. **Phase** — fases por obra  
4. **Discipline** — disciplinas  
5. **Category** — categorias por disciplina  
6. **AuditPhase** — fases de auditoria (PL, LO, etc.)  
7. **ChecklistItem** — itens de checklist (biblioteca)  
8. **Audit** — cabeçalho das auditorias  
9. **AuditItem** — itens avaliados por auditoria  
10. **AuditCustomItem** — apenas se houver itens customizados na planilha  
11. **Attachment** — evidências (se houver URLs ou caminhos)  
12. **AuditLog** — em geral não se importa; opcional  

Cada etapa só roda se o config tiver a entidade e houver dados na aba correspondente.

## Abas e colunas (exemplo)

### Usuários (User)

| Coluna na planilha (exemplo) | Campo no banco | Obrigatório |
|-----------------------------|----------------|-------------|
| Nome                        | name           | Sim         |
| Email                       | email          | Sim (único) |
| Senha                       | password       | Sim (hash)  |
| Perfil                      | role           | Não (default: AUDITOR) |

Valores de **Perfil:** ADMIN, AUDITOR, READER. Duplicata por email: **pular** (onDuplicate: skip).

### Obras (Work)

| Coluna na planilha | Campo no banco | Obrigatório |
|--------------------|----------------|-------------|
| Nome               | name           | Sim         |
| Código             | code           | Não (único) |
| Ativo              | active         | Não (default: true) |

Duplicata por **Código:** pular.

### Fases (Phase)

| Coluna na planilha | Campo no banco | Obrigatório |
|--------------------|----------------|-------------|
| Obra Código        | workCode       | Sim (FK)    |
| Nome               | name           | Sim         |
| Ordem              | order          | Não (0)     |
| Ativo              | active         | Não (true)  |

O script resolve **Obra Código** para `workId` usando o mapa de obras já importadas.

### Disciplinas (Discipline)

| Coluna na planilha | Campo no banco |
|--------------------|----------------|
| Nome               | name (único)   |
| Ordem              | order          |
| Ativo              | active         |

### Categorias (Category)

| Coluna na planilha | Campo no banco |
|--------------------|----------------|
| Disciplina         | disciplineName (FK) |
| Nome               | name           |
| Ordem              | order          |
| Ativo              | active         |

### Fases Auditoria (AuditPhase)

| Coluna na planilha | Campo no banco |
|--------------------|----------------|
| Nome               | name (único, ex: PL, LO) |
| Label              | label          |
| Ordem              | order          |
| Ativo              | active         |

### Itens Checklist (ChecklistItem)

| Coluna na planilha | Campo no banco |
|--------------------|----------------|
| Disciplina         | disciplineName |
| Categoria          | categoryName   |
| Fase Auditoria     | auditPhaseName |
| Código             | code           |
| Descrição          | description    |
| Peso               | weight         |
| Pontos Máx         | maxPoints      |
| Ativo              | active         |

### Auditorias (Audit)

| Coluna na planilha | Campo no banco |
|--------------------|----------------|
| Obra Código        | workCode → workId |
| Fase Nome          | phaseName → phaseId |
| Disciplina         | disciplineName → disciplineId |
| Fase Auditoria     | auditPhaseName → auditPhaseId |
| Título             | title          |
| Data Início        | startDate      |
| Data Fim           | endDate        |
| Status             | status (IN_PROGRESS, WAITING_FOR_ISSUES, COMPLETED, CANCELED) |
| Auditor Email      | auditorEmail → auditorId |
| Criado Por Email   | createdByEmail → createdById |

### Itens Auditoria (AuditItem)

| Coluna na planilha | Campo no banco |
|--------------------|----------------|
| Auditoria Título   | auditTitle → auditId |
| Item Código        | checklistItemCode (opcional) |
| Categoria / Disciplina | para resolver checklistItemId |
| Status             | status (NOT_STARTED, CONFORMING, NONCONFORMING, OBSERVATION, NA, etc.) |
| Evidência          | evidenceText   |
| Construflow Ref    | construflowRef |

## Uso do script

1. Defina `DATABASE_URL` no ambiente (ou em `.env` na raiz do projeto).  
2. Gere o cliente Prisma a partir do schema em `packages/db`:  
   `npm run generate` (dentro de `scripts/`).  
3. Execute:  
   `npm run import -- planilha.xlsx`  
   ou:  
   `tsx import-spreadsheet.ts planilha.xlsx`  
4. Verifique o log gerado (`import-log-YYYYMMDD-HHmmss.txt`): totais por entidade, linhas com erro (número da linha + mensagem), erros de constraint.

## Regras de duplicidade

- **User:** mesmo email → pular (skip).  
- **Work:** mesmo código → pular.  
- **Discipline:** mesmo nome → pular.  
- **AuditPhase:** mesmo name → pular.  
- Outras entidades: inserir; se houver unique constraint no banco, o script registra o erro no log.

## Relatório pós-importação

O script gera ao final:

- Quantidade inserida por entidade  
- Linhas ignoradas (vazias ou por regra de duplicidade)  
- Linhas com erro (número da linha e motivo)  
- Erros de banco (constraint, FK)  

Opcionalmente pode ser gerado um arquivo com as linhas que falharam para correção na planilha e nova tentativa.
