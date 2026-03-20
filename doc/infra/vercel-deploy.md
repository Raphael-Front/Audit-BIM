# Deploy no Vercel – App Next.js

O projeto é uma **única aplicação Next.js** (App Router) na raiz do repositório.

## 1. Configuração do projeto Vercel

- Conecte o repositório ao Vercel.
- **Root Directory**: deixe **vazio** (raiz do repo).
- Framework: Next.js (detectado automaticamente pelo `vercel.json`).

## 2. Variáveis de ambiente

No Vercel: **Settings** → **Environment Variables**. Adicione:

| Nome | Descrição | Ambiente |
|------|-----------|----------|
| `DATABASE_URL` | Connection string do PostgreSQL (Supabase: `postgresql://...`) | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`) | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima (public) do Supabase | Production, Preview |
| `SUPABASE_URL` | URL do projeto (para scripts e server-side) | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (server-side, migrações) | Production, Preview |

Opcional:
| `NEXT_PUBLIC_APP_URL` | URL pública do app (ex.: `https://audit-bim.vercel.app`) — para links de email | Production |

**Importante:** faça um **Redeploy** após alterar variáveis de ambiente.

## 3. Resumo

| O que | Como |
|-------|------|
| Deploy | Push para o branch principal (ou configuração de branch no Vercel) |
| Build | `next build` (executado pelo Vercel) |
| Variáveis obrigatórias | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*` |

Se o login ou os dados não funcionarem em produção, confira se as variáveis estão corretas e se o redeploy foi feito após alterá-las.
