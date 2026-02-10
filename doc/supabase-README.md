# Supabase (BIM Audit Cloud)

Este projeto usa Supabase como backend:

- **PostgreSQL**: tabelas em `supabase/migrations/` (001 a 005).
- **Auth**: Supabase Auth; perfis em `user_profiles`.
- **Storage**: bucket `audit-evidencias` para evidências (JPG, PNG, PDF).
- **Edge Functions**: `create-audit`, `update-audit-status`, `upload-evidence`, `calculate-score`, `send-notifications`, `sync-construflow`.

## Configuração

1. Crie um projeto no [Supabase](https://supabase.com).
2. Defina no frontend (`.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Para scripts de importação e Edge Functions:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Migrations

Com Supabase CLI (a partir da raiz do projeto):

```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

Ou aplique os SQL em `supabase/migrations/` manualmente no SQL Editor do dashboard.

## Edge Functions

Deploy (Supabase CLI):

```bash
supabase functions deploy create-audit --no-verify-jwt
supabase functions deploy update-audit-status
supabase functions deploy upload-evidence
supabase functions deploy calculate-score
supabase functions deploy send-notifications
supabase functions deploy sync-construflow
```

Recomenda-se `verify_jwt: true` em produção; use variáveis de ambiente no dashboard para as chaves.

## Storage

O bucket `audit-evidencias` é criado pela migration 004. Estrutura de path: `{obra_id}/auditorias/{auditoria_id}/evidencias/{arquivo}`.
