-- BIM Audit — Dimensões (dim_*)
-- Depende: 001_enums.sql

CREATE TABLE dim_obras (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     VARCHAR(50) NOT NULL UNIQUE,
  nome       VARCHAR(200) NOT NULL,
  endereco   TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE dim_fases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           VARCHAR(20) NOT NULL UNIQUE,
  nome             VARCHAR(100) NOT NULL,
  descricao        TEXT,
  ordem_sequencial INTEGER NOT NULL DEFAULT 0,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dim_disciplinas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     VARCHAR(20) NOT NULL UNIQUE,
  nome       VARCHAR(100) NOT NULL,
  descricao  TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dim_categorias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          VARCHAR(50) NOT NULL,
  nome            VARCHAR(200) NOT NULL,
  descricao       TEXT,
  disciplina_id   UUID REFERENCES dim_disciplinas(id) ON DELETE RESTRICT,
  ordem_exibicao  INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dim_usuarios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) NOT NULL UNIQUE,
  nome_completo  VARCHAR(200) NOT NULL,
  senha_hash     VARCHAR(255) NOT NULL,
  perfil         perfil_usuario NOT NULL DEFAULT 'auditor_bim',
  ativo          BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dim_categorias_disciplina ON dim_categorias(disciplina_id);
