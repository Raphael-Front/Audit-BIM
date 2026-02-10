# BIM Audit Web

Monorepo: **apps/api** (NestJS), **apps/web** (Vite + React), **packages/db**, **packages/shared**.

Documentação em [doc/](doc/).

## Desenvolvimento

```bash
npm install
npm run dev          # API + Web
npm run dev:api      # só API
npm run dev:web      # só Web
```

## Scripts

- `npm run build` / `npm run lint` / `npm run typecheck` — em todos os workspaces
- `npm run db:generate` / `npm run db:migrate` / `npm run db:seed` — banco
- `npm run import -- <planilha.xlsx>` — importar planilha
