# Docker – Projeto Auditoria BIM

## Serviços

- **postgres** – PostgreSQL 16 (porta 5432)
- **api** – API NestJS (porta 3001)
- **web** – Next.js (porta 3000)
- **migrate** – Rodar migrações Prisma (perfil `tools`)

## Build (builder)

Construir todas as imagens:

```bash
# Na raiz do projeto
npm run docker:build
```

Ou só uma:

```bash
docker compose -f infra/docker-compose.yml build api
docker compose -f infra/docker-compose.yml build web
```

## Subir o ambiente

1. Crie um `.env` na **raiz** (ou use os valores padrão):

   ```env
   JWT_SECRET=seu-secret-jwt
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```
   `NEXT_PUBLIC_API_URL` é usada pelo navegador para chamar a API; em desenvolvimento local use `http://localhost:3001`.

2. Suba os containers:

   ```bash
   npm run docker:up
   ```

3. (Opcional) Rodar migrações e seed na primeira vez:

   ```bash
   npm run docker:migrate
   # Seed: conecte no postgres ou rode localmente com DATABASE_URL apontando para localhost:5432
   ```

## Parar

```bash
npm run docker:down
```

## URLs

- Web: http://localhost:3000  
- API: http://localhost:3001  
- Postgres: localhost:5432 (user `bim_audit`, db `bim_audit`, password `bim_audit`)
