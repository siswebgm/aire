-- =============================================
-- TABELA DE USUÁRIOS - SCHEMA COBRANCAS
-- =============================================

-- 1. TIPO ENUM para perfil do usuário
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'gvt_perfil_usuario' AND n.nspname = 'cobrancas') THEN
    CREATE TYPE cobrancas.gvt_perfil_usuario AS ENUM (
      'ADMIN',        -- Administrador geral (acesso total)
      'OPERADOR',     -- Operador do sistema (gerencia portas)
      'CLIENTE'       -- Cliente final (apenas visualiza/usa portas autorizadas)
    );
  END IF;
END
$$;

-- 2. TABELA: gvt_usuarios
-- =============================================
CREATE TABLE IF NOT EXISTS cobrancas.gvt_usuarios (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES cobrancas.gvt_condominios(uid) ON DELETE CASCADE,
  
  -- Dados de acesso
  email TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  
  -- Dados pessoais
  nome TEXT NOT NULL,
  telefone TEXT,
  documento TEXT,           -- CPF ou outro documento
  
  -- Perfil e permissões
  perfil cobrancas.gvt_perfil_usuario NOT NULL DEFAULT 'CLIENTE',
  
  -- Controle
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Email único por condomínio
  CONSTRAINT gvt_usuarios_email_condominio_unique UNIQUE (condominio_uid, email)
);

-- 3. ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_gvt_usuarios_condominio 
  ON cobrancas.gvt_usuarios(condominio_uid);

CREATE INDEX IF NOT EXISTS idx_gvt_usuarios_email 
  ON cobrancas.gvt_usuarios(email);

CREATE INDEX IF NOT EXISTS idx_gvt_usuarios_perfil 
  ON cobrancas.gvt_usuarios(perfil);

-- 4. TRIGGER para atualizar updated_at
-- =============================================
CREATE OR REPLACE FUNCTION cobrancas.gvt_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gvt_usuarios_updated_at ON cobrancas.gvt_usuarios;
CREATE TRIGGER trigger_gvt_usuarios_updated_at
  BEFORE UPDATE ON cobrancas.gvt_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION cobrancas.gvt_update_updated_at();

-- 5. PERMISSÕES
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_usuarios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_usuarios TO authenticated;

-- 6. COMENTÁRIOS
-- =============================================
COMMENT ON TABLE cobrancas.gvt_usuarios IS 'Usuários do sistema de gaveteiros';
COMMENT ON COLUMN cobrancas.gvt_usuarios.perfil IS 'ADMIN=acesso total, OPERADOR=gerencia portas, CLIENTE=usa portas autorizadas';
COMMENT ON COLUMN cobrancas.gvt_usuarios.senha_hash IS 'Senha criptografada (usar bcrypt ou similar)';

-- =============================================
-- DADOS DE TESTE (senhas em texto simples para desenvolvimento)
-- IMPORTANTE: Em produção, usar bcrypt ou similar!
-- =============================================

-- Admin do Condomínio Central (senha: 123456)
INSERT INTO cobrancas.gvt_usuarios (uid, condominio_uid, email, senha_hash, nome, telefone, perfil) VALUES
  ('eeee1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
   'admin@condominiocentral.com', '123456', 'Administrador Central', '11999999999', 'ADMIN')
ON CONFLICT (condominio_uid, email) DO NOTHING;

-- Operador do Condomínio Central (senha: 123456)
INSERT INTO cobrancas.gvt_usuarios (uid, condominio_uid, email, senha_hash, nome, telefone, perfil) VALUES
  ('eeee2222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
   'operador@condominiocentral.com', '123456', 'João Operador', '11988888888', 'OPERADOR')
ON CONFLICT (condominio_uid, email) DO NOTHING;

-- Cliente do Condomínio Central (senha: 123456)
INSERT INTO cobrancas.gvt_usuarios (uid, condominio_uid, email, senha_hash, nome, telefone, perfil) VALUES
  ('eeee3333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
   'cliente@email.com', '123456', 'Maria Cliente', '11977777777', 'CLIENTE')
ON CONFLICT (condominio_uid, email) DO NOTHING;

-- Admin do Residencial Park (senha: 123456)
INSERT INTO cobrancas.gvt_usuarios (uid, condominio_uid, email, senha_hash, nome, telefone, perfil) VALUES
  ('ffff1111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 
   'admin@residencialpark.com', '123456', 'Administrador Park', '11966666666', 'ADMIN')
ON CONFLICT (condominio_uid, email) DO NOTHING;

-- Admin do Empresarial Tower (senha: 123456)
INSERT INTO cobrancas.gvt_usuarios (uid, condominio_uid, email, senha_hash, nome, telefone, perfil) VALUES
  ('ffff2222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 
   'admin@empresarialtower.com', '123456', 'Administrador Tower', '11955555555', 'ADMIN')
ON CONFLICT (condominio_uid, email) DO NOTHING;

-- =============================================
-- VERIFICAÇÃO
-- =============================================
SELECT 
  u.nome,
  u.email,
  u.perfil,
  c.nome AS condominio
FROM cobrancas.gvt_usuarios u
JOIN cobrancas.gvt_condominios c ON c.uid = u.condominio_uid
ORDER BY c.nome, u.perfil, u.nome;
