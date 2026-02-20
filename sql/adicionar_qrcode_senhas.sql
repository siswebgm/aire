-- =============================================
-- ADICIONAR COLUNAS qrcode_data E qrcode_url NA TABELA gvt_senhas_provisorias
-- qrcode_data = payload JSON do QR Code (dados para retirada)
-- qrcode_url = URL pública para exibir o QR Code ao morador
-- O QR Code NÃO é exibido ao entregador, apenas ao morador
-- =============================================

-- 1. Adicionar coluna qrcode_data (payload JSON do QR)
ALTER TABLE cobrancas.gvt_senhas_provisorias
ADD COLUMN IF NOT EXISTS qrcode_data TEXT;

-- 2. Adicionar coluna qrcode_url (URL pública para exibir o QR)
ALTER TABLE cobrancas.gvt_senhas_provisorias
ADD COLUMN IF NOT EXISTS qrcode_url TEXT;

-- 3. Comentários
COMMENT ON COLUMN cobrancas.gvt_senhas_provisorias.qrcode_data IS 'Payload JSON do QR Code para retirada. Não exibir ao entregador.';
COMMENT ON COLUMN cobrancas.gvt_senhas_provisorias.qrcode_url IS 'URL pública para exibir o QR Code ao morador. Ex: /qr/{uid}';
