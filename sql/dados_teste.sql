-- =============================================
-- DADOS DE TESTE - SISTEMA DE GAVETEIROS
-- Execute este script no SQL Editor do Supabase
-- =============================================

-- 1. CRIAR CONDOMÍNIOS
-- =============================================

insert into gaveteiro.condominios (uid, nome, documento, descricao) values
  ('11111111-1111-1111-1111-111111111111', 'Condomínio Central', '12.345.678/0001-01', 'Edifício principal no centro'),
  ('22222222-2222-2222-2222-222222222222', 'Residencial Park', '12.345.678/0001-02', 'Condomínio residencial zona sul'),
  ('33333333-3333-3333-3333-333333333333', 'Empresarial Tower', '12.345.678/0001-03', 'Prédio comercial')
on conflict (uid) do nothing;

-- 2. CRIAR GAVETEIROS
-- =============================================

-- Gaveteiros do Condomínio Central
insert into gaveteiro.gaveteiros (uid, condominio_uid, nome, codigo_hardware, descricao) values
  ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Portaria Principal', 'ESP32-PORT-001', 'Gaveteiro na portaria principal'),
  ('aaaa2222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Hall Elevadores', 'ESP32-HALL-001', 'Gaveteiro no hall dos elevadores')
on conflict (uid) do nothing;

-- Gaveteiros do Residencial Park
insert into gaveteiro.gaveteiros (uid, condominio_uid, nome, codigo_hardware, descricao) values
  ('bbbb1111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Guarita Entrada', 'ESP32-GUA-001', 'Gaveteiro na guarita de entrada'),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Área de Lazer', 'ESP32-LAZ-001', 'Gaveteiro na área de lazer')
on conflict (uid) do nothing;

-- Gaveteiros do Empresarial Tower
insert into gaveteiro.gaveteiros (uid, condominio_uid, nome, codigo_hardware, descricao) values
  ('cccc1111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Recepção Térreo', 'ESP32-REC-001', 'Gaveteiro na recepção do térreo'),
  ('cccc2222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Sala de Encomendas', 'ESP32-ENC-001', 'Gaveteiro na sala de encomendas')
on conflict (uid) do nothing;

-- 3. CRIAR PORTAS (8 portas por gaveteiro, com status variados)
-- =============================================

-- Portaria Principal (Condomínio Central) - 8 portas
insert into gaveteiro.portas (condominio_uid, gaveteiro_uid, numero_porta, status_atual, ocupado_em) values
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 1, 'DISPONIVEL', null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 2, 'OCUPADO', now() - interval '2 hours'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 3, 'OCUPADO', now() - interval '30 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 4, 'DISPONIVEL', null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 5, 'BAIXADO', now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 6, 'DISPONIVEL', null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 7, 'AGUARDANDO_RETIRADA', now() - interval '45 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 8, 'DISPONIVEL', null)
on conflict (gaveteiro_uid, numero_porta) do nothing;

-- Hall Elevadores (Condomínio Central) - 6 portas
insert into gaveteiro.portas (condominio_uid, gaveteiro_uid, numero_porta, status_atual, ocupado_em) values
  ('11111111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 1, 'DISPONIVEL', null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 2, 'OCUPADO', now() - interval '5 hours'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 3, 'DISPONIVEL', null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 4, 'OCUPADO', now() - interval '15 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 5, 'DISPONIVEL', null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa2222-2222-2222-2222-222222222222', 6, 'BAIXADO', now() - interval '3 hours')
on conflict (gaveteiro_uid, numero_porta) do nothing;

-- Guarita Entrada (Residencial Park) - 10 portas
insert into gaveteiro.portas (condominio_uid, gaveteiro_uid, numero_porta, status_atual, ocupado_em) values
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 1, 'DISPONIVEL', null),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 2, 'DISPONIVEL', null),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 3, 'OCUPADO', now() - interval '1 hour'),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 4, 'OCUPADO', now() - interval '20 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 5, 'DISPONIVEL', null),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 6, 'OCUPADO', now() - interval '4 hours'),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 7, 'DISPONIVEL', null),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 8, 'AGUARDANDO_RETIRADA', now() - interval '10 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 9, 'DISPONIVEL', null),
  ('22222222-2222-2222-2222-222222222222', 'bbbb1111-1111-1111-1111-111111111111', 10, 'BAIXADO', now() - interval '6 hours')
on conflict (gaveteiro_uid, numero_porta) do nothing;

-- Área de Lazer (Residencial Park) - 4 portas
insert into gaveteiro.portas (condominio_uid, gaveteiro_uid, numero_porta, status_atual, ocupado_em) values
  ('22222222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 1, 'DISPONIVEL', null),
  ('22222222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 2, 'OCUPADO', now() - interval '45 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 3, 'DISPONIVEL', null),
  ('22222222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 4, 'DISPONIVEL', null)
on conflict (gaveteiro_uid, numero_porta) do nothing;

-- Recepção Térreo (Empresarial Tower) - 12 portas
insert into gaveteiro.portas (condominio_uid, gaveteiro_uid, numero_porta, status_atual, ocupado_em) values
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 1, 'DISPONIVEL', null),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 2, 'OCUPADO', now() - interval '3 hours'),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 3, 'OCUPADO', now() - interval '1 hour'),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 4, 'DISPONIVEL', null),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 5, 'OCUPADO', now() - interval '30 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 6, 'DISPONIVEL', null),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 7, 'BAIXADO', now() - interval '2 hours'),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 8, 'DISPONIVEL', null),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 9, 'OCUPADO', now() - interval '4 hours'),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 10, 'DISPONIVEL', null),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 11, 'AGUARDANDO_RETIRADA', now() - interval '25 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'cccc1111-1111-1111-1111-111111111111', 12, 'DISPONIVEL', null)
on conflict (gaveteiro_uid, numero_porta) do nothing;

-- Sala de Encomendas (Empresarial Tower) - 8 portas
insert into gaveteiro.portas (condominio_uid, gaveteiro_uid, numero_porta, status_atual, ocupado_em) values
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 1, 'OCUPADO', now() - interval '8 hours'),
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 2, 'OCUPADO', now() - interval '6 hours'),
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 3, 'OCUPADO', now() - interval '2 hours'),
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 4, 'DISPONIVEL', null),
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 5, 'OCUPADO', now() - interval '1 hour'),
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 6, 'BAIXADO', now() - interval '30 minutes'),
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 7, 'DISPONIVEL', null),
  ('33333333-3333-3333-3333-333333333333', 'cccc2222-2222-2222-2222-222222222222', 8, 'OCUPADO', now() - interval '45 minutes')
on conflict (gaveteiro_uid, numero_porta) do nothing;

-- 4. ATUALIZAR finalizado_em PARA PORTAS BAIXADAS
-- =============================================

update gaveteiro.portas
set finalizado_em = ocupado_em + interval '1 hour'
where status_atual = 'BAIXADO'
  and finalizado_em is null;

-- =============================================
-- RESUMO DOS DADOS CRIADOS:
-- =============================================
-- 3 Condomínios
-- 6 Gaveteiros (2 por condomínio)
-- 48 Portas no total:
--   - Condomínio Central: 14 portas
--   - Residencial Park: 14 portas
--   - Empresarial Tower: 20 portas
-- 
-- Status variados:
--   - DISPONIVEL: ~20 portas
--   - OCUPADO: ~18 portas (com tempos variados)
--   - BAIXADO: ~6 portas
--   - AGUARDANDO_RETIRADA: ~4 portas
-- =============================================

-- Verificar dados inseridos
select 
  c.nome as condominio,
  g.nome as gaveteiro,
  count(*) as total_portas,
  count(*) filter (where p.status_atual = 'DISPONIVEL') as disponiveis,
  count(*) filter (where p.status_atual = 'OCUPADO') as ocupadas,
  count(*) filter (where p.status_atual = 'BAIXADO') as baixadas,
  count(*) filter (where p.status_atual = 'AGUARDANDO_RETIRADA') as aguardando
from gaveteiro.condominios c
join gaveteiro.gaveteiros g on g.condominio_uid = c.uid
join gaveteiro.portas p on p.gaveteiro_uid = g.uid
group by c.nome, g.nome
order by c.nome, g.nome;
