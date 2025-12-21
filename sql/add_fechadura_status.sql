-- ============================================
-- Adicionar colunas para status físico da fechadura
-- Tabela: cobrancas.gvt_portas
-- Constraint: (gaveteiro_uid, numero_porta) é UNIQUE
-- ============================================

-- 1. Adicionar coluna fechadura_status (estado físico da fechadura)
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS fechadura_status VARCHAR(20) DEFAULT 'fechada';

-- 2. Adicionar coluna sensor_status (estado do sensor magnético)
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS sensor_status VARCHAR(20) DEFAULT 'desconhecido';

-- 3. Adicionar coluna para última atualização do status físico
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS status_fisico_atualizado_em TIMESTAMP WITH TIME ZONE;

-- Comentários nas colunas
COMMENT ON COLUMN cobrancas.gvt_portas.fechadura_status IS 'Status físico da fechadura: aberta, fechada';
COMMENT ON COLUMN cobrancas.gvt_portas.sensor_status IS 'Status do sensor magnético: aberto (porta aberta), fechado (porta fechada), desconhecido';
COMMENT ON COLUMN cobrancas.gvt_portas.status_fisico_atualizado_em IS 'Última vez que o status físico foi atualizado pelo ESP32';

-- Criar índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_portas_fechadura_status ON cobrancas.gvt_portas(fechadura_status);
CREATE INDEX IF NOT EXISTS idx_portas_sensor_status ON cobrancas.gvt_portas(sensor_status);

-- ============================================
-- COMO FUNCIONA:
-- A porta é identificada por (gaveteiro_uid + numero_porta)
-- Quando ESP32 abre/fecha, o frontend atualiza:
--   UPDATE gvt_portas 
--   SET fechadura_status = 'aberta', status_fisico_atualizado_em = NOW()
--   WHERE gaveteiro_uid = 'xxx' AND numero_porta = 1;
-- ============================================

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'cobrancas' 
  AND table_name = 'gvt_portas'
  AND column_name IN ('fechadura_status', 'sensor_status', 'status_fisico_atualizado_em');
