-- =============================================
-- ADICIONAR CAMPOS BLOCO, APARTAMENTO, COMPARTILHADA E SENHAS
-- NA TABELA DE MOVIMENTAÇÕES E PORTAS
-- Execute este script no SQL Editor do Supabase
-- =============================================

-- =============================================
-- MOVIMENTAÇÕES - Campos para rastreabilidade
-- =============================================

-- Adicionar coluna bloco (obrigatório para ocupar)
ALTER TABLE cobrancas.gvt_movimentacoes_porta 
ADD COLUMN IF NOT EXISTS bloco TEXT;

-- Adicionar coluna apartamento (obrigatório para ocupar)
ALTER TABLE cobrancas.gvt_movimentacoes_porta 
ADD COLUMN IF NOT EXISTS apartamento TEXT;

-- Adicionar coluna compartilhada (indica se tem mais de um destinatário)
ALTER TABLE cobrancas.gvt_movimentacoes_porta 
ADD COLUMN IF NOT EXISTS compartilhada BOOLEAN DEFAULT FALSE;

-- =============================================
-- PORTAS - Campos para ocupação atual
-- =============================================

-- Bloco atual (pode ser múltiplos separados por vírgula se compartilhada)
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS bloco_atual TEXT;

-- Apartamento atual (pode ser múltiplos separados por vírgula se compartilhada)
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS apartamento_atual TEXT;

-- Flag de compartilhada
ALTER TABLE cobrancas.gvt_portas 
ADD COLUMN IF NOT EXISTS compartilhada BOOLEAN DEFAULT FALSE;

-- =============================================
-- TABELA DE SENHAS PROVISÓRIAS POR DESTINATÁRIO
-- Cada destinatário (bloco+apartamento) tem sua própria senha
-- =============================================

CREATE TABLE IF NOT EXISTS cobrancas.gvt_senhas_provisorias (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  porta_uid UUID NOT NULL REFERENCES cobrancas.gvt_portas(uid) ON DELETE CASCADE,
  condominio_uid UUID NOT NULL REFERENCES cobrancas.gvt_condominios(uid) ON DELETE CASCADE,
  bloco TEXT NOT NULL,
  apartamento TEXT NOT NULL,
  senha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ATIVA', -- ATIVA, USADA, CANCELADA
  usada_em TIMESTAMPTZ,
  usada_por UUID, -- usuario_uid que usou
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_gvt_senhas_porta 
  ON cobrancas.gvt_senhas_provisorias(porta_uid);
CREATE INDEX IF NOT EXISTS idx_gvt_senhas_status 
  ON cobrancas.gvt_senhas_provisorias(status);
CREATE INDEX IF NOT EXISTS idx_gvt_senhas_bloco_apto 
  ON cobrancas.gvt_senhas_provisorias(bloco, apartamento);

-- ÍNDICE ÚNICO: Garante que senhas ATIVAS nunca se repetem no condomínio
-- Isso evita conflitos se duas portas tiverem a mesma senha
CREATE UNIQUE INDEX IF NOT EXISTS idx_gvt_senhas_unica_ativa
  ON cobrancas.gvt_senhas_provisorias(condominio_uid, senha) 
  WHERE status = 'ATIVA';

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_senhas_provisorias TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_senhas_provisorias TO authenticated;

-- =============================================
-- CONDOMÍNIOS - Senha mestre
-- =============================================

-- Senha mestre do condomínio (libera qualquer porta)
ALTER TABLE cobrancas.gvt_condominios 
ADD COLUMN IF NOT EXISTS senha_mestre TEXT;

-- =============================================
-- ÍNDICES PARA BUSCA RÁPIDA
-- =============================================

CREATE INDEX IF NOT EXISTS idx_gvt_mov_bloco 
  ON cobrancas.gvt_movimentacoes_porta(bloco);

CREATE INDEX IF NOT EXISTS idx_gvt_mov_apartamento 
  ON cobrancas.gvt_movimentacoes_porta(apartamento);

CREATE INDEX IF NOT EXISTS idx_gvt_mov_bloco_apto 
  ON cobrancas.gvt_movimentacoes_porta(bloco, apartamento);

CREATE INDEX IF NOT EXISTS idx_gvt_portas_bloco_atual 
  ON cobrancas.gvt_portas(bloco_atual);

CREATE INDEX IF NOT EXISTS idx_gvt_portas_apto_atual 
  ON cobrancas.gvt_portas(apartamento_atual);

-- =============================================
-- VERIFICAR ESTRUTURA ATUALIZADA
-- =============================================

SELECT 'MOVIMENTACOES' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'cobrancas' 
  AND table_name = 'gvt_movimentacoes_porta'
  AND column_name IN ('bloco', 'apartamento', 'compartilhada')
UNION ALL
SELECT 'PORTAS' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'cobrancas' 
  AND table_name = 'gvt_portas'
  AND column_name IN ('bloco_atual', 'apartamento_atual', 'compartilhada')
UNION ALL
SELECT 'CONDOMINIOS' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'cobrancas' 
  AND table_name = 'gvt_condominios'
  AND column_name = 'senha_mestre'
UNION ALL
SELECT 'SENHAS_PROVISORIAS' as tabela, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'cobrancas' 
  AND table_name = 'gvt_senhas_provisorias'
ORDER BY tabela, column_name;

-- =============================================
-- CONFIGURAR SENHA MESTRE DO CONDOMÍNIO
-- Descomente e altere conforme necessário
-- =============================================

-- Exemplo: Definir senha mestre "123456" para um condomínio específico
-- UPDATE cobrancas.gvt_condominios 
-- SET senha_mestre = '123456' 
-- WHERE uid = 'SEU-UID-DO-CONDOMINIO';

-- Exemplo: Definir senha mestre para todos os condomínios
-- UPDATE cobrancas.gvt_condominios 
-- SET senha_mestre = '000000' 
-- WHERE senha_mestre IS NULL;
