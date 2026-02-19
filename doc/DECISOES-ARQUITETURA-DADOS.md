# Decisões de arquitetura de dados — Auditoria BIM

## 1. Por que materializar scores?

Os scores (percentual geral, totais por disciplina e por categoria) são calculados a partir de dezenas ou centenas de itens por auditoria. Recalcular em toda leitura do dashboard ou ao abrir uma auditoria geraria:

- Muitos `COUNT`/`SUM`/`FILTER` em `fato_auditoria_itens` por request.
- Latência alta em listagens (Kanban, filtros por obra/fase).

Ao materializar em `tbl_scores_calculados`, `tbl_scores_por_disciplina` e `tbl_scores_por_categoria`:

- O dashboard e as telas de resumo leem uma única linha (ou poucas) por auditoria.
- A atualização é feita por **trigger** após INSERT/UPDATE/DELETE em `fato_auditoria_itens`, garantindo consistência com os dados transacionais.
- Índices em `auditoria_id` permitem JOINs rápidos com `fato_auditorias`.

**Trade-off**: escrita um pouco mais pesada ao alterar itens (recalcular scores); leitura muito mais leve e previsível.

---

## 2. Estratégia de soft delete

- **Obras (`dim_obras`)**: campo `deleted_at` (TIMESTAMPTZ). Registros ativos são filtrados com `WHERE deleted_at IS NULL`. Não se remove obra fisicamente para preservar histórico de auditorias já vinculadas.

- **Auditorias (`fato_auditorias`)**: não há `deleted_at`. “Exclusão” é feita por **status** `cancelada`, com preenchimento de `motivo_cancelamento`, `cancelado_por_id` e `cancelado_em`. Uma **RULE** no PostgreSQL (`rule_no_delete_auditoria`) impede `DELETE` físico na tabela, forçando o uso desse fluxo.

- **Outras entidades**: dimensões (fases, disciplinas, categorias) e templates usam flag `ativo` para “desligar” sem apagar, preservando integridade referencial e histórico.

---

## 3. Versionamento de templates

- **Campo `versao`** em `tbl_checklist_template`: permite evoluir o mesmo item de checklist ao longo do tempo (ex.: versão 1, 2) sem perder o vínculo com auditorias antigas.

- **Inativação**: `inativado_em` e `inativado_por_id` registram quando (e por quem) um item foi “aposentado”. Itens inativos podem permanecer na base para consulta e para que `fato_auditoria_itens` continue referenciando o template pelo `template_item_id`.

- **Snapshot em itens de auditoria**: em `fato_auditoria_itens` são guardados `item_verificacao_snapshot`, `peso_snapshot` e `pontos_maximo_snapshot`. Assim, mesmo que o template seja alterado ou inativado, o conteúdo e a pontuação usados naquela auditoria ficam preservados.

---

## 4. Granularidade do audit trail

O histórico em `tbl_historico_alteracoes` é **por campo**:

- `tabela_nome`, `registro_id`: qual entidade e qual linha.
- `campo_nome`: qual atributo mudou.
- `valor_anterior` e `valor_novo`: texto (ou JSON serializado) para comparação e relatórios.
- `acao`: não só CRUD genérico (INSERT, UPDATE, DELETE), mas também eventos de negócio (ex.: CONCLUIR_AUDITORIA, CANCELAR_AUDITORIA, PAUSAR, RETOMAR, FINALIZAR_VERIFICACAO).

Isso permite:

- Relatórios do tipo “quem alterou o quê e quando”.
- Atendimento a exigências de rastreabilidade e auditoria regulatória.
- Análise de mudanças de status e de conteúdo por campo, sem depender apenas de um JSON “before/after” opaco.

A aplicação (ou triggers) deve preencher `tbl_historico_alteracoes` sempre que houver alteração relevante nas tabelas transacionais e de configuração.

---

## 5. Fase única (dim_fases)

A especificação adota apenas **“fase da auditoria”** (EP, PL, LO, AS_BUILT), modelada em `dim_fases`. Não existe tabela de “fase da obra” ou “fase do empreendimento”.

- A **chave única de negócio** da auditoria é `(obra_id, disciplina_id, fase_id, revisao)`.
- `fase_id` referencia sempre `dim_fases` (EP, PL, LO, AS_BUILT).
- Aplicabilidade de itens de template às fases é modelada pela tabela N:N `tbl_template_aplicabilidade_fases` (template × fase), permitindo que o mesmo item seja aplicável a uma ou mais fases e que o conjunto de itens varie por fase (ex.: PL com menos itens que LO).
