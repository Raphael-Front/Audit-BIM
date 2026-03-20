-- BIM Audit — Funções: recálculo de scores e registro de histórico
-- Depende: 004_fatos.sql, 006_historico.sql, 007_scores_relatorios.sql

-- Recalcula e persiste scores para uma auditoria (geral, por disciplina, por categoria).
-- Itens com status nao_aplicavel não entram em pontos_possiveis nem em total_aplicavel.
CREATE OR REPLACE FUNCTION fn_recalcular_scores(p_auditoria_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_itens       INTEGER;
  v_total_aplicavel   INTEGER;
  v_total_conforme     INTEGER;
  v_total_nao_conforme INTEGER;
  v_total_na           INTEGER;
  v_pontos_obtidos    DECIMAL(10,2);
  v_pontos_possiveis  DECIMAL(10,2);
  v_score_geral       DECIMAL(5,2);
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status <> 'nao_aplicavel'),
    COUNT(*) FILTER (WHERE status IN ('conforme', 'corrigido')),
    COUNT(*) FILTER (WHERE status = 'nao_conforme'),
    COUNT(*) FILTER (WHERE status = 'nao_aplicavel'),
    COALESCE(SUM(pontos_obtidos), 0),
    COALESCE(SUM(CASE WHEN status <> 'nao_aplicavel' THEN pontos_maximo_snapshot ELSE 0 END), 0)
  INTO
    v_total_itens,
    v_total_aplicavel,
    v_total_conforme,
    v_total_nao_conforme,
    v_total_na,
    v_pontos_obtidos,
    v_pontos_possiveis
  FROM fato_auditoria_itens
  WHERE auditoria_id = p_auditoria_id;

  v_score_geral := ROUND((v_pontos_obtidos / NULLIF(v_pontos_possiveis, 0)) * 100, 2);

  INSERT INTO tbl_scores_calculados (
    auditoria_id, score_geral, total_itens, total_aplicavel,
    total_conforme, total_nao_conforme, total_na, pontos_obtidos, pontos_possiveis, ultima_atualizacao
  ) VALUES (
    p_auditoria_id, v_score_geral, v_total_itens, v_total_aplicavel,
    v_total_conforme, v_total_nao_conforme, v_total_na, v_pontos_obtidos, v_pontos_possiveis, NOW()
  )
  ON CONFLICT (auditoria_id) DO UPDATE SET
    score_geral = EXCLUDED.score_geral,
    total_itens = EXCLUDED.total_itens,
    total_aplicavel = EXCLUDED.total_aplicavel,
    total_conforme = EXCLUDED.total_conforme,
    total_nao_conforme = EXCLUDED.total_nao_conforme,
    total_na = EXCLUDED.total_na,
    pontos_obtidos = EXCLUDED.pontos_obtidos,
    pontos_possiveis = EXCLUDED.pontos_possiveis,
    ultima_atualizacao = NOW();

  -- Scores por disciplina
  INSERT INTO tbl_scores_por_disciplina (
    auditoria_id, disciplina_id, score_disciplina, total_itens, total_aplicavel,
    total_conforme, total_nao_conforme, total_na, pontos_obtidos, pontos_possiveis, ultima_atualizacao
  )
  SELECT
    p_auditoria_id,
    disciplina_id,
    ROUND((COALESCE(SUM(pontos_obtidos), 0) / NULLIF(SUM(CASE WHEN status <> 'nao_aplicavel' THEN pontos_maximo_snapshot ELSE 0 END), 0)) * 100, 2),
    COUNT(*),
    COUNT(*) FILTER (WHERE status <> 'nao_aplicavel'),
    COUNT(*) FILTER (WHERE status IN ('conforme', 'corrigido')),
    COUNT(*) FILTER (WHERE status = 'nao_conforme'),
    COUNT(*) FILTER (WHERE status = 'nao_aplicavel'),
    COALESCE(SUM(pontos_obtidos), 0),
    COALESCE(SUM(CASE WHEN status <> 'nao_aplicavel' THEN pontos_maximo_snapshot ELSE 0 END), 0),
    NOW()
  FROM fato_auditoria_itens
  WHERE auditoria_id = p_auditoria_id
  GROUP BY disciplina_id
  ON CONFLICT (auditoria_id, disciplina_id) DO UPDATE SET
    score_disciplina = EXCLUDED.score_disciplina,
    total_itens = EXCLUDED.total_itens,
    total_aplicavel = EXCLUDED.total_aplicavel,
    total_conforme = EXCLUDED.total_conforme,
    total_nao_conforme = EXCLUDED.total_nao_conforme,
    total_na = EXCLUDED.total_na,
    pontos_obtidos = EXCLUDED.pontos_obtidos,
    pontos_possiveis = EXCLUDED.pontos_possiveis,
    ultima_atualizacao = NOW();

  -- Scores por categoria
  INSERT INTO tbl_scores_por_categoria (
    auditoria_id, categoria_id, score_categoria, total_itens, total_aplicavel,
    total_conforme, total_nao_conforme, total_na, pontos_obtidos, pontos_possiveis, ultima_atualizacao
  )
  SELECT
    p_auditoria_id,
    categoria_id,
    ROUND((COALESCE(SUM(pontos_obtidos), 0) / NULLIF(SUM(CASE WHEN status <> 'nao_aplicavel' THEN pontos_maximo_snapshot ELSE 0 END), 0)) * 100, 2),
    COUNT(*),
    COUNT(*) FILTER (WHERE status <> 'nao_aplicavel'),
    COUNT(*) FILTER (WHERE status IN ('conforme', 'corrigido')),
    COUNT(*) FILTER (WHERE status = 'nao_conforme'),
    COUNT(*) FILTER (WHERE status = 'nao_aplicavel'),
    COALESCE(SUM(pontos_obtidos), 0),
    COALESCE(SUM(CASE WHEN status <> 'nao_aplicavel' THEN pontos_maximo_snapshot ELSE 0 END), 0),
    NOW()
  FROM fato_auditoria_itens
  WHERE auditoria_id = p_auditoria_id
  GROUP BY categoria_id
  ON CONFLICT (auditoria_id, categoria_id) DO UPDATE SET
    score_categoria = EXCLUDED.score_categoria,
    total_itens = EXCLUDED.total_itens,
    total_aplicavel = EXCLUDED.total_aplicavel,
    total_conforme = EXCLUDED.total_conforme,
    total_nao_conforme = EXCLUDED.total_nao_conforme,
    total_na = EXCLUDED.total_na,
    pontos_obtidos = EXCLUDED.pontos_obtidos,
    pontos_possiveis = EXCLUDED.pontos_possiveis,
    ultima_atualizacao = NOW();
END;
$$;

-- Registra uma linha no histórico (por campo). Chamada por triggers ou pela aplicação.
-- usuario_id pode vir de session (current_setting('app.current_user_id')) se a app definir.
CREATE OR REPLACE FUNCTION fn_registrar_historico(
  p_tabela_nome   VARCHAR(100),
  p_registro_id   UUID,
  p_campo_nome    VARCHAR(100),
  p_valor_anterior TEXT,
  p_valor_novo    TEXT,
  p_acao         acao_historico,
  p_usuario_id   UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := COALESCE(p_usuario_id, (current_setting('app.current_user_id', true))::UUID);
  IF v_usuario_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO tbl_historico_alteracoes (
    id, tabela_nome, registro_id, campo_nome, valor_anterior, valor_novo, acao, usuario_id
  ) VALUES (
    gen_random_uuid(), p_tabela_nome, p_registro_id, p_campo_nome,
    p_valor_anterior, p_valor_novo, p_acao, v_usuario_id
  );
END;
$$;
