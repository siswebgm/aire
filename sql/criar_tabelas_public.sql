-- =============================================
-- CRIAR TABELAS NO SCHEMA PUBLIC COM PREFIXO gvt_
-- Execute este script no SQL Editor do Supabase
-- =============================================

-- 1. TIPO ENUM para status da porta
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gvt_status_porta') THEN
    CREATE TYPE gvt_status_porta AS ENUM (
      'DISPONIVEL',
      'OCUPADO',
      'AGUARDANDO_RETIRADA',
      'BAIXADO'
    );
  END IF;
END
$$;

-- 2. TIPO ENUM para tipo de autorização
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gvt_tipo_autorizacao') THEN
    CREATE TYPE gvt_tipo_autorizacao AS ENUM ('USUARIO', 'PERFIL');
  END IF;
END
$$;

-- 3. TABELA: gvt_condominios
-- =============================================
CREATE TABLE IF NOT EXISTS gvt_condominios (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  documento TEXT,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA: gvt_gaveteiros
-- =============================================
CREATE TABLE IF NOT EXISTS gvt_gaveteiros (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES gvt_condominios(uid) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo_hardware TEXT UNIQUE NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gvt_gaveteiros_condominio 
  ON gvt_gaveteiros(condominio_uid);

-- 5. TABELA: gvt_portas
-- =============================================
CREATE TABLE IF NOT EXISTS gvt_portas (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES gvt_condominios(uid) ON DELETE CASCADE,
  gaveteiro_uid UUID NOT NULL REFERENCES gvt_gaveteiros(uid) ON DELETE CASCADE,
  numero_porta INTEGER NOT NULL,
  status_atual gvt_status_porta NOT NULL DEFAULT 'DISPONIVEL',
  ocupado_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ,
  ultimo_evento_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cliente_uid UUID,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (gaveteiro_uid, numero_porta)
);

CREATE INDEX IF NOT EXISTS idx_gvt_portas_condominio 
  ON gvt_portas(condominio_uid);
CREATE INDEX IF NOT EXISTS idx_gvt_portas_gaveteiro 
  ON gvt_portas(gaveteiro_uid);
CREATE INDEX IF NOT EXISTS idx_gvt_portas_status 
  ON gvt_portas(status_atual);

-- 6. TABELA: gvt_autorizacoes_porta
-- =============================================
CREATE TABLE IF NOT EXISTS gvt_autorizacoes_porta (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES gvt_condominios(uid) ON DELETE CASCADE,
  porta_uid UUID NOT NULL REFERENCES gvt_portas(uid) ON DELETE CASCADE,
  tipo gvt_tipo_autorizacao NOT NULL,
  usuario_uid UUID,
  perfil TEXT,
  senha_hash TEXT,
  valido_de TIMESTAMPTZ,
  valido_ate TIMESTAMPTZ,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gvt_aut_porta ON gvt_autorizacoes_porta(porta_uid);
CREATE INDEX IF NOT EXISTS idx_gvt_aut_usuario ON gvt_autorizacoes_porta(usuario_uid);
CREATE INDEX IF NOT EXISTS idx_gvt_aut_perfil ON gvt_autorizacoes_porta(perfil);
CREATE INDEX IF NOT EXISTS idx_gvt_aut_condominio ON gvt_autorizacoes_porta(condominio_uid);

-- 7. TABELA: gvt_movimentacoes_porta
-- =============================================
CREATE TABLE IF NOT EXISTS gvt_movimentacoes_porta (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES gvt_condominios(uid) ON DELETE CASCADE,
  porta_uid UUID NOT NULL REFERENCES gvt_portas(uid) ON DELETE CASCADE,
  usuario_uid UUID,
  acao TEXT NOT NULL,
  status_resultante TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origem TEXT,
  observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_gvt_mov_porta 
  ON gvt_movimentacoes_porta(porta_uid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gvt_mov_usuario 
  ON gvt_movimentacoes_porta(usuario_uid);
CREATE INDEX IF NOT EXISTS idx_gvt_mov_condominio 
  ON gvt_movimentacoes_porta(condominio_uid);

-- =============================================
-- PERMISSÕES PARA ACESSO ANÔNIMO (anon)
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_condominios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_gaveteiros TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_portas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_autorizacoes_porta TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_movimentacoes_porta TO anon;

-- =============================================
-- PERMISSÕES PARA USUÁRIOS AUTENTICADOS (authenticated)
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_condominios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_gaveteiros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_portas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_autorizacoes_porta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gvt_movimentacoes_porta TO authenticated;

-- =============================================
-- CONFIRMAÇÃO
-- =============================================
SELECT 'Tabelas criadas com sucesso!' AS status;
