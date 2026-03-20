-- RPC para obter ou criar a categoria "Outros" vinculada a uma disciplina
-- Executa com privilégios elevados para contornar RLS
CREATE OR REPLACE FUNCTION public.get_or_create_outros_category(p_disciplina_id UUID)
RETURNS TABLE(id UUID, nome TEXT) AS $$
DECLARE
  v_cat_id UUID;
  v_cat_nome TEXT := 'Outros';
BEGIN
  -- Buscar categoria Outros (por codigo ou nome)
  SELECT c.id, c.nome INTO v_cat_id, v_cat_nome
  FROM public.dim_categorias c
  WHERE (c.codigo = 'OUTROS' OR c.nome = 'Outros') AND c.ativo = true
  LIMIT 1;

  IF v_cat_id IS NULL THEN
    -- Criar categoria se não existir
    INSERT INTO public.dim_categorias (codigo, nome, "ordemExibicao", ativo, "createdAt", "updatedAt")
    VALUES ('OUTROS', 'Outros', 9999, true, NOW(), NOW())
    RETURNING id, nome INTO v_cat_id, v_cat_nome;
  END IF;

  -- Garantir vínculo com a disciplina
  INSERT INTO public.dim_categorias_disciplinas ("categoriaId", "disciplinaId", "ordemExibicao")
  VALUES (v_cat_id, p_disciplina_id, 9999)
  ON CONFLICT ("categoriaId", "disciplinaId") DO NOTHING;

  RETURN QUERY SELECT v_cat_id, v_cat_nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
