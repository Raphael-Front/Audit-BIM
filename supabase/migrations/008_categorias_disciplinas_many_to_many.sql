-- Tabela de junção: uma categoria pode estar vinculada a várias disciplinas
CREATE TABLE "dim_categorias_disciplinas" (
  "categoriaId" UUID NOT NULL,
  "disciplinaId" UUID NOT NULL,
  "ordemExibicao" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dim_categorias_disciplinas_pkey" PRIMARY KEY ("categoriaId", "disciplinaId")
);

-- Migrar dados existentes: cada categoria com disciplinaId vira uma linha na junção
INSERT INTO "dim_categorias_disciplinas" ("categoriaId", "disciplinaId", "ordemExibicao")
SELECT id, "disciplinaId", "ordemExibicao"
FROM "dim_categorias"
WHERE "disciplinaId" IS NOT NULL;

-- Remover FK e coluna antiga de dim_categorias
ALTER TABLE "dim_categorias" DROP CONSTRAINT IF EXISTS "dim_categorias_disciplinaId_fkey";
ALTER TABLE "dim_categorias" DROP COLUMN IF EXISTS "disciplinaId";

-- FKs da nova tabela
ALTER TABLE "dim_categorias_disciplinas"
  ADD CONSTRAINT "dim_categorias_disciplinas_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "dim_categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dim_categorias_disciplinas"
  ADD CONSTRAINT "dim_categorias_disciplinas_disciplinaId_fkey"
  FOREIGN KEY ("disciplinaId") REFERENCES "dim_disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "dim_categorias_disciplinas_disciplinaId_idx" ON "dim_categorias_disciplinas"("disciplinaId");
CREATE INDEX "dim_categorias_disciplinas_categoriaId_idx" ON "dim_categorias_disciplinas"("categoriaId");

-- RLS para a nova tabela (mesmo critério das outras dims)
ALTER TABLE public.dim_categorias_disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dim_categorias_disciplinas_admin" ON public.dim_categorias_disciplinas FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "dim_categorias_disciplinas_auditor" ON public.dim_categorias_disciplinas FOR SELECT USING (public.get_user_role() = 'auditor');
CREATE POLICY "dim_categorias_disciplinas_visualizador" ON public.dim_categorias_disciplinas FOR SELECT USING (public.get_user_role() = 'visualizador');
