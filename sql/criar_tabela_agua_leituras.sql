-- Leitura/consumo de água por apartamento (mensal)

-- 1) Campo de tarifa no condomínio (R$/m³)
alter table if exists cobrancas.gvt_condominios
  add column if not exists tarifa_agua_m3 numeric(12,2);

-- 2) Tabela de leituras
create table if not exists cobrancas.gvt_agua_leituras (
  uid uuid primary key default gen_random_uuid(),
  condominio_uid uuid not null,
  apartamento_uid uuid not null,
  bloco_uid uuid,
  referencia_mes date not null, -- usar o 1º dia do mês como referência (ex.: 2026-02-01)
  leitura_atual integer not null,
  leitura_anterior integer,
  consumo integer,
  tarifa_m3 numeric(12,2),
  valor numeric(12,2),
  foto_url text,
  foto_path text,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gvt_agua_leituras_leitura_nonnegative check (leitura_atual >= 0),
  constraint gvt_agua_leituras_consumo_nonnegative check (consumo is null or consumo >= 0)
);

-- 3) Unicidade por mês/apartamento
create unique index if not exists gvt_agua_leituras_unique_mes_apt
  on cobrancas.gvt_agua_leituras (condominio_uid, apartamento_uid, referencia_mes);

-- 4) Índices úteis
create index if not exists gvt_agua_leituras_by_cond_ref
  on cobrancas.gvt_agua_leituras (condominio_uid, referencia_mes);

create index if not exists gvt_agua_leituras_by_apt_ref
  on cobrancas.gvt_agua_leituras (apartamento_uid, referencia_mes);

-- 5) Permissões (mesmo padrão dos demais scripts)
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_agua_leituras TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON cobrancas.gvt_agua_leituras TO authenticated;
