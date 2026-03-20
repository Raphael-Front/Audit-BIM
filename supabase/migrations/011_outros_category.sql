-- Categoria "Outros" para itens personalizados que não se encaixam nas categorias existentes
INSERT INTO "dim_categorias" ("id", "codigo", "nome", "ordemExibicao", "ativo", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'OUTROS',
  'Outros',
  9999,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "dim_categorias" WHERE "codigo" = 'OUTROS');

-- Vincular "Outros" a todas as disciplinas
INSERT INTO "dim_categorias_disciplinas" ("categoriaId", "disciplinaId", "ordemExibicao")
SELECT c.id, d.id, 9999
FROM "dim_categorias" c
CROSS JOIN "dim_disciplinas" d
WHERE c."codigo" = 'OUTROS'
  AND d."ativo" = true
  AND NOT EXISTS (
    SELECT 1 FROM "dim_categorias_disciplinas" cd 
    WHERE cd."categoriaId" = c.id AND cd."disciplinaId" = d.id
  );
