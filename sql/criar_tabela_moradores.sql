-- =============================================
-- TABELA DE MORADORES - SCHEMA COBRANCAS
-- =============================================

-- 1. TIPO ENUM para tipo de morador
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'gvt_tipo_morador' AND n.nspname = 'cobrancas') THEN
    CREATE TYPE cobrancas.gvt_tipo_morador AS ENUM (
      'PROPRIETARIO',
      'INQUILINO'
    );
  END IF;
END
$$;

-- 2. TABELA: gvt_moradores
-- =============================================
CREATE TABLE IF NOT EXISTS cobrancas.gvt_moradores (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES cobrancas.gvt_condominios(uid) ON DELETE CASCADE,
  
  -- Dados do morador principal
  nome TEXT NOT NULL,
  whatsapp TEXT,
  
  -- Localização no condomínio
  bloco TEXT,
  apartamento TEXT NOT NULL,
  
  -- Tipo de morador
  tipo cobrancas.gvt_tipo_morador NOT NULL DEFAULT 'PROPRIETARIO',
  
  -- Contatos adicionais (JSON array)
  -- Formato: [{"nome": "Maria", "whatsapp": "11999999999"}, {"nome": "João", "whatsapp": "11888888888"}]
  contatos_adicionais JSONB DEFAULT '[]'::jsonb,
  
  -- Observações
  observacao TEXT,
  
  -- Controle
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Apartamento único por bloco no condomínio
  CONSTRAINT gvt_moradores_apartamento_unique UNIQUE (condominio_uid, bloco, apartamento)
);

-- 3. ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_gvt_moradores_condominio 
  ON cobrancas.gvt_moradores(condominio_uid);

CREATE INDEX IF NOT EXISTS idx_gvt_moradores_bloco 
  ON cobrancas.gvt_moradores(bloco);

CREATE INDEX IF NOT EXISTS idx_gvt_moradores_apartamento 
  ON cobrancas.gvt_moradores(apartamento);

CREATE INDEX IF NOT EXISTS idx_gvt_moradores_tipo 
  ON cobrancas.gvt_moradores(tipo);

CREATE INDEX IF NOT EXISTS idx_gvt_moradores_whatsapp 
  ON cobrancas.gvt_moradores(whatsapp);

-- Índice GIN para busca em contatos_adicionais (JSON)
CREATE INDEX IF NOT EXISTS idx_gvt_moradores_contatos 
  ON cobrancas.gvt_moradores USING GIN (contatos_adicionais);

-- 4. TRIGGER para atualizar updated_at
-- =============================================
DROP TRIGGER IF EXISTS trigger_gvt_moradores_updated_at ON cobrancas.gvt_moradores;
CREATE TRIGGER trigger_gvt_moradores_updated_at
  BEFORE UPDATE ON cobrancas.gvt_moradores
  FOR EACH ROW
  EXECUTE FUNCTION cobrancas.gvt_update_updated_at();

-- 5. PERMISSÕES
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_moradores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_moradores TO authenticated;

-- 6. COMENTÁRIOS
-- =============================================
COMMENT ON TABLE cobrancas.gvt_moradores IS 'Moradores do condomínio';
COMMENT ON COLUMN cobrancas.gvt_moradores.tipo IS 'PROPRIETARIO ou INQUILINO';
COMMENT ON COLUMN cobrancas.gvt_moradores.contatos_adicionais IS 'Array JSON com contatos extras: [{"nome": "...", "whatsapp": "..."}]';
COMMENT ON COLUMN cobrancas.gvt_moradores.bloco IS 'Bloco/Torre do apartamento (pode ser NULL para condomínios sem blocos)';

-- =============================================
-- DADOS DE TESTE
-- =============================================

-- Moradores do Condomínio Central
INSERT INTO cobrancas.gvt_moradores (uid, condominio_uid, nome, whatsapp, bloco, apartamento, tipo, contatos_adicionais) VALUES
  -- Bloco A
  ('d1111111-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 
   'Carlos Silva', '11999990001', 'A', '101', 'PROPRIETARIO',
   '[{"nome": "Ana Silva", "whatsapp": "11999990002"}]'::jsonb),
  
  ('d1111111-0001-0001-0001-000000000002', '11111111-1111-1111-1111-111111111111', 
   'Maria Santos', '11999990003', 'A', '102', 'INQUILINO',
   '[]'::jsonb),
  
  ('d1111111-0001-0001-0001-000000000003', '11111111-1111-1111-1111-111111111111', 
   'José Oliveira', '11999990004', 'A', '201', 'PROPRIETARIO',
   '[{"nome": "Lucia Oliveira", "whatsapp": "11999990005"}, {"nome": "Pedro Oliveira", "whatsapp": "11999990006"}]'::jsonb),
  
  ('d1111111-0001-0001-0001-000000000004', '11111111-1111-1111-1111-111111111111', 
   'Fernanda Costa', '11999990007', 'A', '202', 'PROPRIETARIO',
   '[]'::jsonb),
  
  -- Bloco B
  ('d1111111-0001-0001-0001-000000000005', '11111111-1111-1111-1111-111111111111', 
   'Roberto Almeida', '11999990008', 'B', '101', 'INQUILINO',
   '[{"nome": "Sandra Almeida", "whatsapp": "11999990009"}]'::jsonb),
  
  ('d1111111-0001-0001-0001-000000000006', '11111111-1111-1111-1111-111111111111', 
   'Patricia Lima', '11999990010', 'B', '102', 'PROPRIETARIO',
   '[]'::jsonb),
  
  ('d1111111-0001-0001-0001-000000000007', '11111111-1111-1111-1111-111111111111', 
   'Marcos Ferreira', '11999990011', 'B', '201', 'PROPRIETARIO',
   '[{"nome": "Julia Ferreira", "whatsapp": "11999990012"}]'::jsonb),
  
  ('d1111111-0001-0001-0001-000000000008', '11111111-1111-1111-1111-111111111111', 
   'Camila Rocha', '11999990013', 'B', '202', 'INQUILINO',
   '[]'::jsonb)
ON CONFLICT (condominio_uid, bloco, apartamento) DO NOTHING;

-- Moradores do Residencial Park
INSERT INTO cobrancas.gvt_moradores (uid, condominio_uid, nome, whatsapp, bloco, apartamento, tipo, contatos_adicionais) VALUES
  ('d2222222-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222', 
   'Antonio Souza', '11888880001', 'Torre 1', '11', 'PROPRIETARIO',
   '[{"nome": "Helena Souza", "whatsapp": "11888880002"}]'::jsonb),
  
  ('d2222222-0001-0001-0001-000000000002', '22222222-2222-2222-2222-222222222222', 
   'Beatriz Mendes', '11888880003', 'Torre 1', '12', 'INQUILINO',
   '[]'::jsonb),
  
  ('d2222222-0001-0001-0001-000000000003', '22222222-2222-2222-2222-222222222222', 
   'Ricardo Gomes', '11888880004', 'Torre 2', '21', 'PROPRIETARIO',
   '[]'::jsonb),
  
  ('d2222222-0001-0001-0001-000000000004', '22222222-2222-2222-2222-222222222222', 
   'Daniela Castro', '11888880005', 'Torre 2', '22', 'PROPRIETARIO',
   '[{"nome": "Bruno Castro", "whatsapp": "11888880006"}, {"nome": "Carla Castro", "whatsapp": "11888880007"}]'::jsonb)
ON CONFLICT (condominio_uid, bloco, apartamento) DO NOTHING;

-- Moradores do Empresarial Tower (sem blocos - salas comerciais)
INSERT INTO cobrancas.gvt_moradores (uid, condominio_uid, nome, whatsapp, bloco, apartamento, tipo, contatos_adicionais) VALUES
  ('d3333333-0001-0001-0001-000000000001', '33333333-3333-3333-3333-333333333333', 
   'Empresa ABC Ltda', '11777770001', NULL, '101', 'PROPRIETARIO',
   '[{"nome": "João Gerente", "whatsapp": "11777770002"}, {"nome": "Maria Recepção", "whatsapp": "11777770003"}]'::jsonb),
  
  ('d3333333-0001-0001-0001-000000000002', '33333333-3333-3333-3333-333333333333', 
   'Escritório XYZ', '11777770004', NULL, '102', 'INQUILINO',
   '[]'::jsonb),
  
  ('d3333333-0001-0001-0001-000000000003', '33333333-3333-3333-3333-333333333333', 
   'Consultoria Tech', '11777770005', NULL, '201', 'PROPRIETARIO',
   '[{"nome": "Carlos Diretor", "whatsapp": "11777770006"}]'::jsonb),
  
  ('d3333333-0001-0001-0001-000000000004', '33333333-3333-3333-3333-333333333333', 
   'Advocacia Silva', '11777770007', NULL, '202', 'INQUILINO',
   '[]'::jsonb)
ON CONFLICT (condominio_uid, bloco, apartamento) DO NOTHING;

-- =============================================
-- VERIFICAÇÃO
-- =============================================
SELECT 
  c.nome AS condominio,
  m.bloco,
  m.apartamento,
  m.nome,
  m.whatsapp,
  m.tipo,
  jsonb_array_length(m.contatos_adicionais) AS qtd_contatos_extras
FROM cobrancas.gvt_moradores m
JOIN cobrancas.gvt_condominios c ON c.uid = m.condominio_uid
ORDER BY c.nome, m.bloco NULLS LAST, m.apartamento;
