# Scripts SQL — Estrutura dimensional (banco novo)

Scripts para aplicar em um banco PostgreSQL **vazio** (ou após dropar o schema antigo). Ordem de execução:

1. `001_enums.sql` — tipos ENUM
2. `002_dimensoes.sql` — dim_obras, dim_fases, dim_disciplinas, dim_categorias, dim_usuarios
3. `003_biblioteca.sql` — tbl_checklist_template, tbl_template_aplicabilidade_fases
4. `004_fatos.sql` — fato_auditorias, fato_auditoria_itens (e índices)
5. `011_constraints.sql` — FK auditoria_origem_id em tbl_checklist_template
6. `005_anexos_personalizados.sql` — tbl_evidencias_anexos, tbl_itens_personalizados_salvos
7. `006_historico.sql` — tbl_historico_alteracoes
8. `007_scores_relatorios.sql` — tbl_scores_calculados, tbl_scores_por_disciplina, tbl_scores_por_categoria, tbl_relatorios_gerados
9. `008_indexes.sql` — índice GIN full-text
10. `009_functions.sql` — fn_recalcular_scores, fn_registrar_historico
11. `010_triggers.sql` — trigger de scores e RULE rule_no_delete_auditoria

Exemplo (psql):

```bash
psql $DATABASE_URL -f 001_enums.sql
psql $DATABASE_URL -f 002_dimensoes.sql
# ... na ordem acima
```

Alternativa: usar as migrations do Prisma em `packages/db/prisma/migrations` (migration `init_dimensional` contém o schema completo).
