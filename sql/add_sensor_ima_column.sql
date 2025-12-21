-- ============================================
-- Adicionar coluna para sensor do ímã (magnético)
-- Tabela: cobrancas.gvt_portas
-- ============================================

-- Coluna para sensor do ímã (detecta se porta física está aberta/fechada)
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS sensor_ima_status VARCHAR(20) DEFAULT 'desconhecido';

-- Coluna para última atualização do sensor do ímã
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS sensor_ima_atualizado_em TIMESTAMP WITH TIME ZONE;

-- Comentários
COMMENT ON COLUMN cobrancas.gvt_portas.sensor_ima_status IS 'Status do sensor magnético (ímã): aberto (ímã afastado), fechado (ímã encostado)';
COMMENT ON COLUMN cobrancas.gvt_portas.sensor_ima_atualizado_em IS 'Última vez que o sensor do ímã foi atualizado';

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_portas_sensor_ima_status ON cobrancas.gvt_portas(sensor_ima_status);

-- ============================================
-- RESUMO DAS COLUNAS DE STATUS:
-- 
-- fechadura_status: Estado do relé (aberta/fechada)
--   → Controlado pelo comando de abrir/fechar
--
-- sensor_ima_status: Estado do ímã (aberto/fechado)
--   → Detectado pelo sensor magnético no ESP32
--   → aberto = ímã afastado (porta física aberta)
--   → fechado = ímã encostado (porta física fechada)
-- ============================================

-- Verificar se a coluna foi adicionada
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'cobrancas' 
  AND table_name = 'gvt_portas'
  AND column_name LIKE 'sensor_ima%';
