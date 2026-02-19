# Supabase (BIM Audit) — Modo Total

Este projeto usa **Supabase como backend completo** (Opção B):

- **PostgreSQL**: schema Prisma (dim_obras, fato_auditorias, dim_usuarios, etc.).
- **Auth**: Supabase Auth; usuários ligados a `dim_usuarios` via `auth_user_id`.
- **Storage**: bucket `audit-evidencias` para evidências (JPG, PNG, PDF).
- **RLS**: políticas por perfil (admin, auditor, visualizador).

## Configuração

1. Crie um projeto no [Supabase](https://supabase.com).
2. No `.env` (raiz):
   - `VITE_SUPABASE_URL` — URL do projeto
   - `VITE_SUPABASE_ANON_KEY` — chave anon (publishable)
   - `SUPABASE_SERVICE_ROLE_KEY` — para scripts e migração
3. Aplique as migrations `006_prisma_auth_rls.sql`, `007_storage_prisma.sql` e `ensure_dim_usuario_rpc` no SQL Editor ou via CLI.

## Migrations (schema Prisma)

- **006_prisma_auth_rls.sql** — adiciona `auth_user_id` em dim_usuarios, funções `get_dim_usuario_id()` e `get_user_role()`, RLS em todas as tabelas.
- **007_storage_prisma.sql** — bucket e políticas de storage.
- **ensure_dim_usuario** — RPC para criar `dim_usuarios` a partir de novos usuários Supabase Auth.

## Migração de usuários existentes

Se você já tem `dim_usuarios` (ex.: via API/Prisma):

```bash
npx tsx scripts/migrate-users-supabase.ts
```

Cria um usuário em `auth.users` para cada `dim_usuario` sem `auth_user_id`, vincula e define uma senha temporária (o usuário deve trocar no primeiro login).

## Frontend

O frontend usa Supabase diretamente:

- Auth: `supabase.auth.signInWithPassword` / `signOut`
- Dados: `supabase.from('dim_obras')`, `fato_auditorias`, etc.
- Não é mais necessária a API NestJS para o fluxo principal.

## Storage

Path sugerido: `audit-evidencias/{auditoriaItemId}/{filename}`.

## Edge Functions (opcional)

As Edge Functions existentes (`create-audit`, `upload-evidence`, etc.) podem ser adaptadas para o schema Prisma e deployadas com `supabase functions deploy`.
