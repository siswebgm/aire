-- ============================================
-- ADICIONAR COLUNA DESTINATARIOS (JSONB)
-- na tabela gvt_movimentacoes_porta
-- ============================================
-- 
-- Estrutura do JSON:
-- [
--   { "bloco": "16", "apartamento": "102", "quantidade": 1 },
--   { "bloco": "16", "apartamento": "103", "quantidade": 2 },
--   { "bloco": "15", "apartamento": "201", "quantidade": 1 }
-- ]
--

-- 1. Adicionar nova coluna JSONB
ALTER TABLE cobrancas.gvt_movimentacoes_porta
ADD COLUMN IF NOT EXISTS destinatarios jsonb;

COMMENT ON COLUMN cobrancas.gvt_movimentacoes_porta.destinatarios IS 
'Lista de destinatários no formato JSON: [{"bloco": "A", "apartamento": "101", "quantidade": 1}, ...]';

-- 2. Migrar dados existentes (bloco/apartamento separados por vírgula para JSON)
-- Isso converte: bloco="16, 16, 15" apartamento="102, 103, 201"
-- Para: [{"bloco":"16","apartamento":"102"},{"bloco":"16","apartamento":"103"},{"bloco":"15","apartamento":"201"}]

UPDATE cobrancas.gvt_movimentacoes_porta
SET destinatarios = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'bloco', COALESCE(NULLIF(TRIM(b.bloco), ''), bloco),
      'apartamento', TRIM(a.apartamento),
      'quantidade', 1
    )
  )
  FROM unnest(string_to_array(COALESCE(apartamento, ''), ',')) WITH ORDINALITY AS a(apartamento, idx)
  LEFT JOIN unnest(string_to_array(COALESCE(bloco, ''), ',')) WITH ORDINALITY AS b(bloco, idx2)
    ON a.idx = b.idx2
  WHERE TRIM(a.apartamento) != ''
)
WHERE destinatarios IS NULL
  AND (bloco IS NOT NULL OR apartamento IS NOT NULL)
  AND (bloco != '' OR apartamento != '');

-- 3. Para registros simples (sem vírgula), criar JSON com um único elemento
UPDATE cobrancas.gvt_movimentacoes_porta
SET destinatarios = jsonb_build_array(
  jsonb_build_object('bloco', bloco, 'apartamento', apartamento, 'quantidade', 1)
)
WHERE destinatarios IS NULL
  AND bloco IS NOT NULL AND bloco != ''
  AND apartamento IS NOT NULL AND apartamento != ''
  AND bloco NOT LIKE '%,%'
  AND apartamento NOT LIKE '%,%';

-- 4. Criar índice GIN para buscas no JSON
CREATE INDEX IF NOT EXISTS idx_gvt_mov_destinatarios 
ON cobrancas.gvt_movimentacoes_porta USING gin (destinatarios);

-- 5. Índice para buscar por bloco específico dentro do JSON
CREATE INDEX IF NOT EXISTS idx_gvt_mov_destinatarios_bloco
ON cobrancas.gvt_movimentacoes_porta USING gin ((destinatarios -> 'bloco'));

-- ============================================
-- VERIFICAR MIGRAÇÃO
-- ============================================

-- Verificar quantos registros foram migrados
SELECT 
  COUNT(*) as total,
  COUNT(destinatarios) as com_json,
  COUNT(*) - COUNT(destinatarios) as sem_json
FROM cobrancas.gvt_movimentacoes_porta;

-- Ver exemplos da migração
SELECT 
  uid,
  bloco as bloco_antigo,
  apartamento as apto_antigo,
  destinatarios as json_novo
FROM cobrancas.gvt_movimentacoes_porta
WHERE destinatarios IS NOT NULL
LIMIT 10;

-- ============================================
-- EXEMPLOS DE CONSULTAS COM O NOVO FORMATO
-- ============================================

-- Buscar movimentações de um bloco específico
-- SELECT * FROM cobrancas.gvt_movimentacoes_porta
-- WHERE destinatarios @> '[{"bloco": "16"}]';

-- Buscar movimentações de um apartamento específico
-- SELECT * FROM cobrancas.gvt_movimentacoes_porta
-- WHERE destinatarios @> '[{"bloco": "16", "apartamento": "102"}]';

-- Contar quantos destinatários tem cada movimentação
-- SELECT uid, jsonb_array_length(destinatarios) as qtd_destinatarios
-- FROM cobrancas.gvt_movimentacoes_porta
-- WHERE destinatarios IS NOT NULL;
