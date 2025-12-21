-- ============================================
-- Adicionar colunas esp32_ip e esp32_token na tabela gvt_gaveteiros
-- ============================================

-- Adicionar coluna esp32_ip (IP do ESP32 deste gaveteiro)
ALTER TABLE cobrancas.gvt_gaveteiros 
ADD COLUMN IF NOT EXISTS esp32_ip VARCHAR(50);

-- Adicionar coluna esp32_token (Token de autenticação do ESP32)
ALTER TABLE cobrancas.gvt_gaveteiros 
ADD COLUMN IF NOT EXISTS esp32_token VARCHAR(100);

-- Comentários nas colunas
COMMENT ON COLUMN cobrancas.gvt_gaveteiros.esp32_ip IS 'Endereço IP do ESP32 que controla este gaveteiro (ex: 192.168.1.73)';
COMMENT ON COLUMN cobrancas.gvt_gaveteiros.esp32_token IS 'Token de autenticação do ESP32 (Bearer token)';

-- ============================================
-- Exemplo: Atualizar IPs dos gaveteiros
-- ============================================
-- Execute estas queries substituindo pelos IPs reais dos seus ESP32:

-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.73', esp32_token = 'teste' WHERE nome = 'Gaveteiro 01';
-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.74', esp32_token = 'teste' WHERE nome = 'Gaveteiro 02';
-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.75', esp32_token = 'teste' WHERE nome = 'Gaveteiro 03';
-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.76', esp32_token = 'teste' WHERE nome = 'Gaveteiro 04';
-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.77', esp32_token = 'teste' WHERE nome = 'Gaveteiro 05';
-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.78', esp32_token = 'teste' WHERE nome = 'Gaveteiro 06';
-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.79', esp32_token = 'teste' WHERE nome = 'Gaveteiro 07';
-- UPDATE cobrancas.gvt_gaveteiros SET esp32_ip = '192.168.1.80', esp32_token = 'teste' WHERE nome = 'Gaveteiro 08';

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'cobrancas' 
  AND table_name = 'gvt_gaveteiros'
  AND column_name IN ('esp32_ip', 'esp32_token');
