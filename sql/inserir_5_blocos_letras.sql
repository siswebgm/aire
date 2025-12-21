-- =============================================
-- INSERIR 5 BLOCOS (A, B, C, D, E)
-- Condomínio: 22222222-2222-2222-2222-222222222222
-- 
-- Blocos A, B, C: 12 apartamentos por andar (001-012 até 701-712) = 96 apts cada
-- Blocos D, E: 10 apartamentos por andar (001-010 até 701-710) = 80 apts cada
-- =============================================

-- 1. CRIAR 5 BLOCOS
INSERT INTO cobrancas.gvt_blocos (condominio_uid, nome, descricao) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Bloco A', 'Bloco A - 12 apartamentos por andar'),
  ('22222222-2222-2222-2222-222222222222', 'Bloco B', 'Bloco B - 12 apartamentos por andar'),
  ('22222222-2222-2222-2222-222222222222', 'Bloco C', 'Bloco C - 12 apartamentos por andar'),
  ('22222222-2222-2222-2222-222222222222', 'Bloco D', 'Bloco D - 10 apartamentos por andar'),
  ('22222222-2222-2222-2222-222222222222', 'Bloco E', 'Bloco E - 10 apartamentos por andar')
ON CONFLICT (condominio_uid, nome) DO NOTHING;

-- 2. APARTAMENTOS BLOCOS A, B, C (12 por andar, térreo ao 7º = 96 apts cada)
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  b.uid,
  apt.numero,
  apt.andar
FROM cobrancas.gvt_blocos b
CROSS JOIN (VALUES 
  -- Térreo (0)
  ('001', 0), ('002', 0), ('003', 0), ('004', 0), ('005', 0), ('006', 0),
  ('007', 0), ('008', 0), ('009', 0), ('010', 0), ('011', 0), ('012', 0),
  -- 1º Andar
  ('101', 1), ('102', 1), ('103', 1), ('104', 1), ('105', 1), ('106', 1),
  ('107', 1), ('108', 1), ('109', 1), ('110', 1), ('111', 1), ('112', 1),
  -- 2º Andar
  ('201', 2), ('202', 2), ('203', 2), ('204', 2), ('205', 2), ('206', 2),
  ('207', 2), ('208', 2), ('209', 2), ('210', 2), ('211', 2), ('212', 2),
  -- 3º Andar
  ('301', 3), ('302', 3), ('303', 3), ('304', 3), ('305', 3), ('306', 3),
  ('307', 3), ('308', 3), ('309', 3), ('310', 3), ('311', 3), ('312', 3),
  -- 4º Andar
  ('401', 4), ('402', 4), ('403', 4), ('404', 4), ('405', 4), ('406', 4),
  ('407', 4), ('408', 4), ('409', 4), ('410', 4), ('411', 4), ('412', 4),
  -- 5º Andar
  ('501', 5), ('502', 5), ('503', 5), ('504', 5), ('505', 5), ('506', 5),
  ('507', 5), ('508', 5), ('509', 5), ('510', 5), ('511', 5), ('512', 5),
  -- 6º Andar
  ('601', 6), ('602', 6), ('603', 6), ('604', 6), ('605', 6), ('606', 6),
  ('607', 6), ('608', 6), ('609', 6), ('610', 6), ('611', 6), ('612', 6),
  -- 7º Andar
  ('701', 7), ('702', 7), ('703', 7), ('704', 7), ('705', 7), ('706', 7),
  ('707', 7), ('708', 7), ('709', 7), ('710', 7), ('711', 7), ('712', 7)
) AS apt(numero, andar)
WHERE b.condominio_uid = '22222222-2222-2222-2222-222222222222'
  AND b.nome IN ('Bloco A', 'Bloco B', 'Bloco C')
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- 3. APARTAMENTOS BLOCOS D, E (10 por andar, térreo ao 7º = 80 apts cada)
INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  b.uid,
  apt.numero,
  apt.andar
FROM cobrancas.gvt_blocos b
CROSS JOIN (VALUES 
  -- Térreo (0)
  ('001', 0), ('002', 0), ('003', 0), ('004', 0), ('005', 0),
  ('006', 0), ('007', 0), ('008', 0), ('009', 0), ('010', 0),
  -- 1º Andar
  ('101', 1), ('102', 1), ('103', 1), ('104', 1), ('105', 1),
  ('106', 1), ('107', 1), ('108', 1), ('109', 1), ('110', 1),
  -- 2º Andar
  ('201', 2), ('202', 2), ('203', 2), ('204', 2), ('205', 2),
  ('206', 2), ('207', 2), ('208', 2), ('209', 2), ('210', 2),
  -- 3º Andar
  ('301', 3), ('302', 3), ('303', 3), ('304', 3), ('305', 3),
  ('306', 3), ('307', 3), ('308', 3), ('309', 3), ('310', 3),
  -- 4º Andar
  ('401', 4), ('402', 4), ('403', 4), ('404', 4), ('405', 4),
  ('406', 4), ('407', 4), ('408', 4), ('409', 4), ('410', 4),
  -- 5º Andar
  ('501', 5), ('502', 5), ('503', 5), ('504', 5), ('505', 5),
  ('506', 5), ('507', 5), ('508', 5), ('509', 5), ('510', 5),
  -- 6º Andar
  ('601', 6), ('602', 6), ('603', 6), ('604', 6), ('605', 6),
  ('606', 6), ('607', 6), ('608', 6), ('609', 6), ('610', 6),
  -- 7º Andar
  ('701', 7), ('702', 7), ('703', 7), ('704', 7), ('705', 7),
  ('706', 7), ('707', 7), ('708', 7), ('709', 7), ('710', 7)
) AS apt(numero, andar)
WHERE b.condominio_uid = '22222222-2222-2222-2222-222222222222'
  AND b.nome IN ('Bloco D', 'Bloco E')
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- =============================================
-- VERIFICAÇÃO
-- =============================================

-- Total de blocos
SELECT COUNT(*) AS total_blocos 
FROM cobrancas.gvt_blocos 
WHERE condominio_uid = '22222222-2222-2222-2222-222222222222';

-- Total de apartamentos
SELECT COUNT(*) AS total_apartamentos 
FROM cobrancas.gvt_apartamentos 
WHERE condominio_uid = '22222222-2222-2222-2222-222222222222';

-- Apartamentos por bloco
SELECT 
  b.nome AS bloco,
  COUNT(a.uid) AS apartamentos
FROM cobrancas.gvt_blocos b
LEFT JOIN cobrancas.gvt_apartamentos a ON a.bloco_uid = b.uid
WHERE b.condominio_uid = '22222222-2222-2222-2222-222222222222'
GROUP BY b.nome
ORDER BY b.nome;
