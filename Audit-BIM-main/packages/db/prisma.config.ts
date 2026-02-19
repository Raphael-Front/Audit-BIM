import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// Carrega .env da raiz do monorepo (npm run db:migrate é executado com cwd = packages/db)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
