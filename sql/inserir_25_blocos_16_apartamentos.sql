-- =============================================
-- INSERIR 25 BLOCOS COM 16 APARTAMENTOS CADA
-- Condomínio: 11111111-1111-1111-1111-111111111111
-- 4 andares, 4 apartamentos por andar (101-104, 201-204, 301-304, 401-404)
-- =============================================

-- 1. Deletar blocos e apartamentos existentes do condomínio (opcional)
-- DELETE FROM cobrancas.gvt_apartamentos WHERE condominio_uid = '11111111-1111-1111-1111-111111111111';
-- DELETE FROM cobrancas.gvt_blocos WHERE condominio_uid = '11111111-1111-1111-1111-111111111111';

-- 2. CRIAR 25 BLOCOS
INSERT INTO cobrancas.gvt_blocos (condominio_uid, nome, descricao) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Bloco 01', 'Bloco 01'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 02', 'Bloco 02'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 03', 'Bloco 03'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 04', 'Bloco 04'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 05', 'Bloco 05'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 06', 'Bloco 06'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 07', 'Bloco 07'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 08', 'Bloco 08'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 09', 'Bloco 09'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 10', 'Bloco 10'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 11', 'Bloco 11'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 12', 'Bloco 12'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 13', 'Bloco 13'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 14', 'Bloco 14'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 15', 'Bloco 15'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 16', 'Bloco 16'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 17', 'Bloco 17'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 18', 'Bloco 18'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 19', 'Bloco 19'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 20', 'Bloco 20'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 21', 'Bloco 21'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 22', 'Bloco 22'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 23', 'Bloco 23'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 24', 'Bloco 24'),
  ('11111111-1111-1111-1111-111111111111', 'Bloco 25', 'Bloco 25')
ON CONFLICT (condominio_uid, nome) DO NOTHING;

-- 3. CRIAR 16 APARTAMENTOS POR BLOCO (4 andares x 4 apartamentos)
-- Apartamentos: 101, 102, 103, 104, 201, 202, 203, 204, 301, 302, 303, 304, 401, 402, 403, 404

INSERT INTO cobrancas.gvt_apartamentos (condominio_uid, bloco_uid, numero, andar)
SELECT 
  '11111111-1111-1111-1111-111111111111',
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
  ('401', 4), ('402', 4), ('403', 4), ('404', 4)
) AS apt(numero, andar)
WHERE b.condominio_uid = '11111111-1111-1111-1111-111111111111'
  AND b.nome LIKE 'Bloco %'
ON CONFLICT (condominio_uid, bloco_uid, numero) DO NOTHING;

-- =============================================
-- VERIFICAÇÃO
-- =============================================

-- Total de blocos
SELECT COUNT(*) AS total_blocos 
FROM cobrancas.gvt_blocos 
WHERE condominio_uid = '11111111-1111-1111-1111-111111111111';

-- Total de apartamentos
SELECT COUNT(*) AS total_apartamentos 
FROM cobrancas.gvt_apartamentos 
WHERE condominio_uid = '11111111-1111-1111-1111-111111111111';

-- Apartamentos por bloco
SELECT 
  b.nome AS bloco,
  COUNT(a.uid) AS apartamentos
FROM cobrancas.gvt_blocos b
LEFT JOIN cobrancas.gvt_apartamentos a ON a.bloco_uid = b.uid
WHERE b.condominio_uid = '11111111-1111-1111-1111-111111111111'
GROUP BY b.nome
ORDER BY b.nome;
