# Mapeamento Planilha → Sistema (BIM Audit)

Este documento descreve como mapear as colunas da sua planilha para as tabelas do sistema.

## Formato esperado da planilha

- **Excel:** arquivo `.xlsx` com uma aba por entidade (Obras, Templates, Template Itens, Auditorias, Auditoria Itens).
- **CSV:** um arquivo por aba, ou um único CSV com colunas que identifiquem a entidade.

## Abas / entidades

### 1. Obras

| Coluna na planilha (exemplo) | Campo no sistema | Obrigatório | Observação |
|-----------------------------|------------------|------------|------------|
| Nome                        | nome             | Sim        | |
| Código                      | codigo           | Não        | Único. Usado para vincular auditorias. |
| Cliente                     | cliente          | Não        | |
| Endereço                    | endereco         | Não        | Pode ser texto ou JSON (rua, cidade, etc.). |
| Status                      | status           | Não        | Valores: ativa, pausada, finalizada. Default: ativa. |

### 2. Templates

| Coluna na planilha | Campo no sistema | Obrigatório |
|--------------------|------------------|------------|
| Nome               | nome             | Sim        |
| Disciplina         | disciplina       | Não        | Ex: Arquitetura, Estrutura, Hidráulica. |
| Versão             | versao           | Não        | Número. Default: 1. |
| Ativo              | ativo            | Não        | true/false ou 1/0. Default: true. |

### 3. Template Itens

| Coluna na planilha | Campo no sistema   | Obrigatório |
|--------------------|--------------------|------------|
| Template           | template_nome      | Sim        | Nome do template para vincular. |
| Ordem              | ordem              | Não        | Número. Default: 0. |
| Categoria          | categoria          | Não        |
| Descrição          | descricao          | Sim        |
| Criticidade        | criticidade        | Não        | baixa, media, alta, critica. |
| Requer Evidência   | requer_evidencia   | Não        | true/false ou 1/0. Default: false. |

### 4. Auditorias

| Coluna na planilha | Campo no sistema   | Obrigatório |
|--------------------|--------------------|------------|
| Obra Código        | obra_codigo        | Sim        | Código da obra (vincula à obra). |
| Template           | template_nome      | Sim        | Nome do template. |
| Título             | titulo             | Não        |
| Data Planejada     | data_planejada     | Não        | Data (YYYY-MM-DD ou DD/MM/YYYY). |
| Data Início        | data_inicio        | Não        | Data/hora. |
| Data Conclusão     | data_conclusao     | Não        | Data/hora. |
| Status             | status             | Não        | planejada, em_andamento, aguardando_apontamentos, concluida, cancelada. |
| Auditor Email      | auditor_email      | Não        | Email do responsável (deve existir em auth.users). |
| Observações        | observacoes_gerais | Não        |

### 5. Auditoria Itens

| Coluna na planilha | Campo no sistema     | Obrigatório |
|--------------------|----------------------|------------|
| Auditoria Título   | auditoria_titulo     | Sim        | Título da auditoria para vincular. |
| Ordem              | ordem                 | Não        |
| Descrição          | descricao            | Sim        |
| Categoria          | categoria            | Não        |
| Criticidade        | criticidade          | Não        |
| Status             | status_avaliacao     | Não        | conforme, nao_conforme, nao_aplicavel, pendente. Default: pendente. |
| Construflow ID     | construflow_id       | Não        |
| Observações        | observacoes          | Não        |
| Customizado        | is_customizado       | Não        | true/false. Default: false. |

## Uso do script de importação

1. Copie `import-config.example.json` para `import-config.json`.
2. Ajuste os nomes das colunas em `sheets.*.columns` para coincidir com os cabeçalhos da sua planilha.
3. Defina as variáveis de ambiente (ou no config):
   - `SUPABASE_URL`: URL do projeto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave service role (para inserção em lote).
4. Execute:
   ```bash
   cd scripts
   npm install
   npm run import -- planilha.xlsx
   ```
   Ou com caminho absoluto:
   ```bash
   npm run import -- ./caminho/para/planilha.xlsx
   ```
5. Verifique o log gerado (`import-log-YYYYMMDD-HHmmss.txt`) para erros e totais.

## Tratamento de duplicatas

- **skip:** ignora a linha se já existir registro com mesmo identificador (ex.: obra com mesmo código).
- **merge:** atualiza o registro existente (não implementado na primeira versão).

## Ordem de importação (automática)

O script importa nesta ordem para respeitar chaves estrangeiras:

1. Obras  
2. Templates  
3. Template Itens  
4. Auditorias (obra por código, template por nome; auditor opcional)  
5. Auditoria Itens (auditoria por título)

Após a importação, o sistema passa a ser a única fonte de verdade; novos dados devem ser inseridos apenas pela aplicação.
