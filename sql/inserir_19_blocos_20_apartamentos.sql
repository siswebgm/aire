-- =============================================
-- INSERIR 19 BLOCOS COM 20 APARTAMENTOS CADA
-- Condomínio: 33333333-3333-3333-3333-333333333333
-- 5 andares, 4 apartamentos por andar (101-104 até 501-504)
-- =============================================

-- 1. CRIAR 19 BLOCOS
INSERT INTO cobrancas.gvt_blocos (condominio_uid, nome, descricao) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Bloco 01', 'Bloco 01'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 02', 'Bloco 02'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 03', 'Bloco 03'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 04', 'Bloco 04'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 05', 'Bloco 05'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 06', 'Bloco 06'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 07', 'Bloco 07'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 08', 'Bloco 08'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 09', 'Bloco 09'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 10', 'Bloco 10'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 11', 'Bloco 11'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 12', 'Bloco 12'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 13', 'Bloco 13'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 14', 'Bloco 14'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 15', 'Bloco 15'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 16', 'Bloco 16'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 17', 'Bloco 17'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 18', 'Bloco 18'),
  ('33333333-3333-3333-3333-333333333333', 'Bloco 19', 'Bloco 19')
ON CONFLICT (condominio_uid, nome) DO NOTHING;

-- 2. CRIAR 20 APARTAMENTOS POR BLOCO (5 andares x 4 apartamentos)
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '33333333-3333-3333-3333-333333333333',
  b.uid,
  apt.numero,
  apt.andar
FROM cobrancas.gvt_blocos b
CROSS JOIN (VALUES 
  -- 1º Andar
  ('101', 1), ('102', 1), ('103', 1), ('104', 1),
  -- 2º Andar
  ('201', 2), ('202', 2), ('203', 2), ('204', 2),
  -- 3º Andar
  ('301', 3), ('302', 3), ('303', 3), ('304', 3),
  -- 4º Andar
  ('401', 4), ('402', 4), ('403', 4), ('404', 4),
  -- 5º Andar
  ('501', 5), ('502', 5), ('503', 5), ('504', 5)
) AS apt(numero, andar)
WHERE b.condominio_uid = '33333333-3333-3333-3333-333333333333'
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- =============================================
-- VERIFICAÇÃO
-- =============================================

-- Total de blocos
SELECT COUNT(*) AS total_blocos 
FROM cobrancas.gvt_blocos 
WHERE condominio_uid = '33333333-3333-3333-3333-333333333333';

-- Total de apartamentos
SELECT COUNT(*) AS total_apartamentos 
FROM cobrancas.gvt_apartamentos 
WHERE condominio_uid = '33333333-3333-3333-3333-333333333333';

-- Apartamentos por bloco
SELECT 
  b.nome AS bloco,
  COUNT(a.uid) AS apartamentos
FROM cobrancas.gvt_blocos b
LEFT JOIN cobrancas.gvt_apartamentos a ON a.bloco_uid = b.uid
WHERE b.condominio_uid = '33333333-3333-3333-3333-333333333333'
GROUP BY b.nome
ORDER BY b.nome;
