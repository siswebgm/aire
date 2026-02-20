-- =============================================
-- ADICIONAR COLUNA tamanho NA TABELA gvt_portas
-- Valores: 'P' (Pequeno), 'M' (Médio), 'G' (Grande), 'GG' (Extra Grande)
-- =============================================

-- 1. Adicionar coluna tamanho (nullable para não quebrar registros existentes)
ALTER TABLE cobrancas.gvt_portas
ADD COLUMN IF NOT EXISTS tamanho VARCHAR(2);

-- 2. Comentário na coluna
COMMENT ON COLUMN cobrancas.gvt_portas.tamanho IS 'Tamanho do armário: P (Pequeno), M (Médio), G (Grande)';

-- 3. Índice para filtrar portas por tamanho (usado no PDV)
CREATE INDEX IF NOT EXISTS idx_gvt_portas_tamanho
  ON cobrancas.gvt_portas(tamanho);

-- 4. (OPCIONAL) Atualizar portas existentes com tamanho padrão
-- Descomente e ajuste conforme sua logística:
--
-- UPDATE cobrancas.gvt_portas SET tamanho = 'P' WHERE numero_porta IN (1,2,3,4);
-- UPDATE cobrancas.gvt_portas SET tamanho = 'M' WHERE numero_porta IN (5,6,7,8);
-- UPDATE cobrancas.gvt_portas SET tamanho = 'G' WHERE numero_porta IN (9,10,11,12);
