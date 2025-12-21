-- =============================================
-- INSERIR MORADORES DE TESTE PARA OS 3 CONDOMÍNIOS
-- =============================================

-- =============================================
-- CONDOMÍNIO 1: 11111111-1111-1111-1111-111111111111
-- 25 Blocos (Bloco 01-25), 16 apartamentos cada
-- =============================================

INSERT INTO cobrancas.gvt_moradores (condominio_uid, nome, whatsapp, bloco, apartamento, tipo, contatos_adicionais, observacao) VALUES
-- Bloco 01
('11111111-1111-1111-1111-111111111111', 'João da Silva Santos', '81999001001', 'Bloco 01', '101', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Maria Oliveira Costa', '81999001002', 'Bloco 01', '102', 'INQUILINO', '[{"nome": "Carlos Costa", "telefone": "81988001002"}]', 'Paga até dia 10'),
('11111111-1111-1111-1111-111111111111', 'Pedro Henrique Lima', '81999001003', 'Bloco 01', '201', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Ana Paula Ferreira', '81999001004', 'Bloco 01', '301', 'PROPRIETARIO', '[]', NULL),
-- Bloco 02
('11111111-1111-1111-1111-111111111111', 'Carlos Eduardo Souza', '81999002001', 'Bloco 02', '101', 'INQUILINO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Fernanda Almeida', '81999002002', 'Bloco 02', '103', 'PROPRIETARIO', '[{"nome": "Roberto Almeida", "telefone": "81988002002"}]', NULL),
('11111111-1111-1111-1111-111111111111', 'Lucas Rodrigues', '81999002003', 'Bloco 02', '202', 'PROPRIETARIO', '[]', NULL),
-- Bloco 03
('11111111-1111-1111-1111-111111111111', 'Juliana Mendes', '81999003001', 'Bloco 03', '101', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Roberto Carlos Nascimento', '81999003002', 'Bloco 03', '201', 'INQUILINO', '[]', 'Contrato vence em Dez/2025'),
('11111111-1111-1111-1111-111111111111', 'Patrícia Gomes', '81999003003', 'Bloco 03', '302', 'PROPRIETARIO', '[]', NULL),
-- Bloco 04
('11111111-1111-1111-1111-111111111111', 'Marcos Vinícius', '81999004001', 'Bloco 04', '102', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Camila Santos', '81999004002', 'Bloco 04', '204', 'INQUILINO', '[]', NULL),
-- Bloco 05
('11111111-1111-1111-1111-111111111111', 'Rodrigo Pereira', '81999005001', 'Bloco 05', '101', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Beatriz Carvalho', '81999005002', 'Bloco 05', '301', 'PROPRIETARIO', '[{"nome": "Esposo", "telefone": "81988005002"}]', NULL),
-- Bloco 06
('11111111-1111-1111-1111-111111111111', 'Thiago Martins', '81999006001', 'Bloco 06', '101', 'INQUILINO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Amanda Ribeiro', '81999006002', 'Bloco 06', '202', 'PROPRIETARIO', '[]', NULL),
-- Bloco 07
('11111111-1111-1111-1111-111111111111', 'Felipe Araújo', '81999007001', 'Bloco 07', '103', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Larissa Barbosa', '81999007002', 'Bloco 07', '401', 'PROPRIETARIO', '[]', NULL),
-- Bloco 08 a 25 (alguns moradores esparsos)
('11111111-1111-1111-1111-111111111111', 'Bruno Cavalcanti', '81999008001', 'Bloco 08', '101', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Aline Freitas', '81999010001', 'Bloco 10', '201', 'INQUILINO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Diego Moreira', '81999012001', 'Bloco 12', '101', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Renata Teixeira', '81999015001', 'Bloco 15', '301', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Gustavo Rocha', '81999018001', 'Bloco 18', '102', 'INQUILINO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Isabela Nunes', '81999020001', 'Bloco 20', '201', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Rafael Monteiro', '81999022001', 'Bloco 22', '401', 'PROPRIETARIO', '[]', NULL),
('11111111-1111-1111-1111-111111111111', 'Vanessa Campos', '81999025001', 'Bloco 25', '101', 'INQUILINO', '[]', NULL)
ON CONFLICT (condominio_uid, bloco, apartamento) DO NOTHING;

-- =============================================
-- CONDOMÍNIO 2: 22222222-2222-2222-2222-222222222222
-- 5 Blocos (A, B, C, D, E)
-- =============================================

INSERT INTO cobrancas.gvt_moradores (condominio_uid, nome, whatsapp, bloco, apartamento, tipo, contatos_adicionais, observacao) VALUES
-- Bloco A (12 apts/andar)
('22222222-2222-2222-2222-222222222222', 'Antonio Bezerra', '81998001001', 'Bloco A', '001', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Cláudia Dias', '81998001002', 'Bloco A', '005', 'INQUILINO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Eduardo Pinto', '81998001003', 'Bloco A', '101', 'PROPRIETARIO', '[{"nome": "Síndico", "telefone": "81988001003"}]', 'Síndico do bloco'),
('22222222-2222-2222-2222-222222222222', 'Fabiana Lopes', '81998001004', 'Bloco A', '205', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Gilberto Ramos', '81998001005', 'Bloco A', '310', 'INQUILINO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Helena Cardoso', '81998001006', 'Bloco A', '412', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Ivan Correia', '81998001007', 'Bloco A', '508', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Jéssica Melo', '81998001008', 'Bloco A', '601', 'INQUILINO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Kleber Andrade', '81998001009', 'Bloco A', '711', 'PROPRIETARIO', '[]', NULL),
-- Bloco B
('22222222-2222-2222-2222-222222222222', 'Leandro Castro', '81998002001', 'Bloco B', '003', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Mônica Silva', '81998002002', 'Bloco B', '107', 'INQUILINO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Nelson Borges', '81998002003', 'Bloco B', '209', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Olívia Duarte', '81998002004', 'Bloco B', '304', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Paulo Fonseca', '81998002005', 'Bloco B', '506', 'INQUILINO', '[]', NULL),
-- Bloco C
('22222222-2222-2222-2222-222222222222', 'Queila Machado', '81998003001', 'Bloco C', '002', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Ricardo Tavares', '81998003002', 'Bloco C', '110', 'PROPRIETARIO', '[{"nome": "Esposa", "telefone": "81988003002"}]', NULL),
('22222222-2222-2222-2222-222222222222', 'Sandra Viana', '81998003003', 'Bloco C', '403', 'INQUILINO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Túlio Rezende', '81998003004', 'Bloco C', '612', 'PROPRIETARIO', '[]', NULL),
-- Bloco D (10 apts/andar)
('22222222-2222-2222-2222-222222222222', 'Úrsula Moura', '81998004001', 'Bloco D', '001', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Valter Guedes', '81998004002', 'Bloco D', '105', 'INQUILINO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Wesley Cunha', '81998004003', 'Bloco D', '208', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Ximena Brito', '81998004004', 'Bloco D', '407', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Yuri Fernandes', '81998004005', 'Bloco D', '603', 'INQUILINO', '[]', NULL),
-- Bloco E (10 apts/andar)
('22222222-2222-2222-2222-222222222222', 'Zilda Nogueira', '81998005001', 'Bloco E', '002', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'André Coelho', '81998005002', 'Bloco E', '106', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Bruna Xavier', '81998005003', 'Bloco E', '309', 'INQUILINO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Caio Siqueira', '81998005004', 'Bloco E', '504', 'PROPRIETARIO', '[]', NULL),
('22222222-2222-2222-2222-222222222222', 'Daniela Aguiar', '81998005005', 'Bloco E', '710', 'INQUILINO', '[]', NULL)
ON CONFLICT (condominio_uid, bloco, apartamento) DO NOTHING;

-- =============================================
-- CONDOMÍNIO 3: 33333333-3333-3333-3333-333333333333
-- 19 Blocos (Bloco 01-19), 20 apartamentos cada
-- =============================================

INSERT INTO cobrancas.gvt_moradores (condominio_uid, nome, whatsapp, bloco, apartamento, tipo, contatos_adicionais, observacao) VALUES
-- Bloco 01
('33333333-3333-3333-3333-333333333333', 'Elias Sampaio', '81997001001', 'Bloco 01', '101', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Flávia Pinheiro', '81997001002', 'Bloco 01', '201', 'INQUILINO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Gabriel Barros', '81997001003', 'Bloco 01', '302', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Heloísa Luz', '81997001004', 'Bloco 01', '403', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Igor Brandão', '81997001005', 'Bloco 01', '504', 'INQUILINO', '[]', NULL),
-- Bloco 02
('33333333-3333-3333-3333-333333333333', 'Joyce Medeiros', '81997002001', 'Bloco 02', '101', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Kevin Assis', '81997002002', 'Bloco 02', '203', 'PROPRIETARIO', '[{"nome": "Mãe", "telefone": "81987002002"}]', NULL),
('33333333-3333-3333-3333-333333333333', 'Luana Paiva', '81997002003', 'Bloco 02', '401', 'INQUILINO', '[]', NULL),
-- Bloco 03
('33333333-3333-3333-3333-333333333333', 'Matheus Dantas', '81997003001', 'Bloco 03', '102', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Natália Rios', '81997003002', 'Bloco 03', '304', 'PROPRIETARIO', '[]', NULL),
-- Bloco 04
('33333333-3333-3333-3333-333333333333', 'Otávio Magalhães', '81997004001', 'Bloco 04', '101', 'INQUILINO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Priscila Toledo', '81997004002', 'Bloco 04', '502', 'PROPRIETARIO', '[]', NULL),
-- Bloco 05
('33333333-3333-3333-3333-333333333333', 'Quirino Sales', '81997005001', 'Bloco 05', '201', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Raquel Franco', '81997005002', 'Bloco 05', '403', 'INQUILINO', '[]', NULL),
-- Bloco 06 a 19 (moradores esparsos)
('33333333-3333-3333-3333-333333333333', 'Sérgio Valente', '81997006001', 'Bloco 06', '101', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Tatiane Lacerda', '81997007001', 'Bloco 07', '202', 'INQUILINO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Ulisses Bastos', '81997008001', 'Bloco 08', '301', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Vera Campos', '81997009001', 'Bloco 09', '104', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Wagner Pacheco', '81997010001', 'Bloco 10', '401', 'INQUILINO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Ximena Cruz', '81997011001', 'Bloco 11', '501', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Yan Silveira', '81997012001', 'Bloco 12', '102', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Zuleica Morais', '81997013001', 'Bloco 13', '203', 'INQUILINO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Alberto Fontes', '81997014001', 'Bloco 14', '301', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Bianca Serra', '81997015001', 'Bloco 15', '404', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'César Gouveia', '81997016001', 'Bloco 16', '101', 'INQUILINO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Denise Quaresma', '81997017001', 'Bloco 17', '502', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Emerson Vilar', '81997018001', 'Bloco 18', '201', 'PROPRIETARIO', '[]', NULL),
('33333333-3333-3333-3333-333333333333', 'Fabíola Jardim', '81997019001', 'Bloco 19', '303', 'INQUILINO', '[]', NULL)
ON CONFLICT (condominio_uid, bloco, apartamento) DO NOTHING;

-- =============================================
-- VERIFICAÇÃO
-- =============================================

-- Total de moradores por condomínio
SELECT 
  condominio_uid,
  COUNT(*) AS total_moradores,
  COUNT(*) FILTER (WHERE tipo = 'PROPRIETARIO') AS proprietarios,
  COUNT(*) FILTER (WHERE tipo = 'INQUILINO') AS inquilinos
FROM cobrancas.gvt_moradores
WHERE condominio_uid IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
GROUP BY condominio_uid
ORDER BY condominio_uid;

-- Lista de moradores
SELECT 
  condominio_uid,
  bloco,
  apartamento,
  nome,
  tipo,
  whatsapp
FROM cobrancas.gvt_moradores
WHERE condominio_uid IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY condominio_uid, bloco, apartamento;
