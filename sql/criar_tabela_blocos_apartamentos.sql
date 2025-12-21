-- =============================================
-- TABELAS DE BLOCOS E APARTAMENTOS - SCHEMA COBRANCAS
-- =============================================

-- 1. TABELA: gvt_blocos
-- =============================================
CREATE TABLE IF NOT EXISTS cobrancas.gvt_blocos (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES cobrancas.gvt_condominios(uid) ON DELETE CASCADE,
  
  nome TEXT NOT NULL,              -- Ex: "Bloco A", "Torre 1", "Prédio Norte"
  descricao TEXT,                  -- Descrição opcional
  
  -- Controle
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Nome único por condomínio
  CONSTRAINT gvt_blocos_nome_unique UNIQUE (condominio_uid, nome)
);

-- 2. TABELA: gvt_apartamentos
-- =============================================
CREATE TABLE IF NOT EXISTS cobrancas.gvt_apartamentos (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_uid UUID NOT NULL REFERENCES cobrancas.gvt_condominios(uid) ON DELETE CASCADE,
  bloco_uid UUID REFERENCES cobrancas.gvt_blocos(uid) ON DELETE SET NULL,
  
  numero TEXT NOT NULL,            -- Ex: "101", "202", "1001"
  andar INTEGER,                   -- Andar (opcional)
  descricao TEXT,                  -- Descrição opcional
  
  -- Controle
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Número único por bloco (ou por condomínio se não tiver bloco)
  CONSTRAINT gvt_apartamentos_numero_unique UNIQUE (condominio_uid, bloco_uid, numero)
);

-- 3. ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_gvt_blocos_condominio 
  ON cobrancas.gvt_blocos(condominio_uid);

CREATE INDEX IF NOT EXISTS idx_gvt_apartamentos_condominio 
  ON cobrancas.gvt_apartamentos(condominio_uid);

CREATE INDEX IF NOT EXISTS idx_gvt_apartamentos_bloco 
  ON cobrancas.gvt_apartamentos(bloco_uid);

-- 4. TRIGGERS para atualizar updated_at
-- =============================================
DROP TRIGGER IF EXISTS trigger_gvt_blocos_updated_at ON cobrancas.gvt_blocos;
CREATE TRIGGER trigger_gvt_blocos_updated_at
  BEFORE UPDATE ON cobrancas.gvt_blocos
  FOR EACH ROW
  EXECUTE FUNCTION cobrancas.gvt_update_updated_at();

DROP TRIGGER IF EXISTS trigger_gvt_apartamentos_updated_at ON cobrancas.gvt_apartamentos;
CREATE TRIGGER trigger_gvt_apartamentos_updated_at
  BEFORE UPDATE ON cobrancas.gvt_apartamentos
  FOR EACH ROW
  EXECUTE FUNCTION cobrancas.gvt_update_updated_at();

-- 5. PERMISSÕES
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_blocos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_blocos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_apartamentos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_apartamentos TO authenticated;

-- 6. COMENTÁRIOS
-- =============================================
COMMENT ON TABLE cobrancas.gvt_blocos IS 'Blocos/Torres do condomínio';
COMMENT ON TABLE cobrancas.gvt_apartamentos IS 'Apartamentos/Unidades do condomínio';

-- =============================================
-- DADOS DE TESTE
-- =============================================

-- BLOCOS DO CONDOMÍNIO CENTRAL
INSERT INTO cobrancas.gvt_blocos (condominio_uid, nome, descricao) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Bloco A', 'Bloco principal'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco B', 'Bloco secundário'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco C', 'Bloco fundos')
ON CONFLICT (condominio_uid, nome) DO NOTHING;

-- BLOCOS DO RESIDENCIAL PARK
INSERT INTO cobrancas.gvt_blocos (condominio_uid, nome, descricao) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Torre 1', 'Torre Norte'),
  ('22222222-2222-2222-2222-222222222222', 'Torre 2', 'Torre Sul'),
  ('22222222-2222-2222-2222-222222222222', 'Torre 3', 'Torre Leste')
ON CONFLICT (condominio_uid, nome) DO NOTHING;

-- EMPRESARIAL TOWER (sem blocos, só apartamentos/salas)

-- APARTAMENTOS DO CONDOMÍNIO CENTRAL - BLOCO A
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '11111111-1111-1111-1111-111111111111',
  b.uid,
  apt.numero,
  apt.andar
FROM cobrancas.gvt_blocos b
CROSS JOIN (VALUES 
  ('101', 1), ('102', 1), ('103', 1), ('104', 1),
  ('201', 2), ('202', 2), ('203', 2), ('204', 2),
  ('301', 3), ('302', 3), ('303', 3), ('304', 3)
) AS apt(numero, andar)
WHERE b.condominio_uid = '11111111-1111-1111-1111-111111111111' AND b.nome = 'Bloco A'
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- APARTAMENTOS DO CONDOMÍNIO CENTRAL - BLOCO B
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '11111111-1111-1111-1111-111111111111',
  b.uid,
  apt.numero,
  apt.andar
FROM cobrancas.gvt_blocos b
CROSS JOIN (VALUES 
  ('101', 1), ('102', 1), ('103', 1), ('104', 1),
  ('201', 2), ('202', 2), ('203', 2), ('204', 2)
) AS apt(numero, andar)
WHERE b.condominio_uid = '11111111-1111-1111-1111-111111111111' AND b.nome = 'Bloco B'
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- APARTAMENTOS DO RESIDENCIAL PARK - TORRE 1
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  b.uid,
  apt.numero,
  apt.andar
FROM cobrancas.gvt_blocos b
CROSS JOIN (VALUES 
  ('11', 1), ('12', 1),
  ('21', 2), ('22', 2),
  ('31', 3), ('32', 3)
) AS apt(numero, andar)
WHERE b.condominio_uid = '22222222-2222-2222-2222-222222222222' AND b.nome = 'Torre 1'
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- APARTAMENTOS DO RESIDENCIAL PARK - TORRE 2
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  b.uid,
  apt.numero,
  apt.andar
FROM cobrancas.gvt_blocos b
CROSS JOIN (VALUES 
  ('11', 1), ('12', 1),
  ('21', 2), ('22', 2)
) AS apt(numero, andar)
WHERE b.condominio_uid = '22222222-2222-2222-2222-222222222222' AND b.nome = 'Torre 2'
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- SALAS DO EMPRESARIAL TOWER (sem bloco)
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar, descricao) VALUES
  ('33333333-3333-3333-3333-333333333333', NULL, '101', 1, 'Sala comercial'),
  ('33333333-3333-3333-3333-333333333333', NULL, '102', 1, 'Sala comercial'),
  ('33333333-3333-3333-3333-333333333333', NULL, '103', 1, 'Sala comercial'),
  ('33333333-3333-3333-3333-333333333333', NULL, '201', 2, 'Sala comercial'),
  ('33333333-3333-3333-3333-333333333333', NULL, '202', 2, 'Sala comercial'),
  ('33333333-3333-3333-3333-333333333333', NULL, '301', 3, 'Sala comercial'),
  ('33333333-3333-3333-3333-333333333333', NULL, '302', 3, 'Sala comercial'),
  ('33333333-3333-3333-3333-333333333333', NULL, '401', 4, 'Sala comercial')
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- =============================================
-- VERIFICAÇÃO
-- =============================================

-- Blocos por condomínio
SELECT 
  c.nome AS condominio,
  COUNT(b.uid) AS total_blocos
FROM cobrancas.gvt_condominios c
LEFT JOIN cobrancas.gvt_blocos b ON b.condominio_uid = c.uid AND b.ativo = TRUE
GROUP BY c.nome
ORDER BY c.nome;

-- Apartamentos por bloco
SELECT 
  c.nome AS condominio,
  COALESCE(b.nome, '(Sem bloco)') AS bloco,
  COUNT(a.uid) AS total_apartamentos
FROM cobrancas.gvt_condominios c
LEFT JOIN cobrancas.gvt_blocos b ON b.condominio_uid = c.uid AND b.ativo = TRUE
LEFT JOIN cobrancas.gvt_apartamentos a ON a.bloco_uid = b.uid OR (a.bloco_uid IS NULL AND a.condominio_uid = c.uid)
WHERE a.ativo = TRUE OR a.uid IS NULL
GROUP BY c.nome, b.nome
ORDER BY c.nome, b.nome NULLS LAST;
