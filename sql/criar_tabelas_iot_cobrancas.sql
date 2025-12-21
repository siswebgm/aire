-- =============================================
-- IOT - Tabelas para comunicação ESP32 <-> Sistema
-- Schema: cobrancas
-- Prefixo: gvt_
-- =============================================

-- 1) Extensão para UUID
create extension if not exists pgcrypto;

-- 2) Dispositivos (cada ESP32 / controlador)
create table if not exists cobrancas.gvt_iot_dispositivos (
  device_id       text primary key,
  token           text not null,
  ativo           boolean not null default true,
  condominio_uid  uuid null,
  gaveteiro_uid   uuid null,
  descricao       text null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_gvt_iot_dispositivos_condominio
  on cobrancas.gvt_iot_dispositivos (condominio_uid);

create index if not exists idx_gvt_iot_dispositivos_gaveteiro
  on cobrancas.gvt_iot_dispositivos (gaveteiro_uid);

-- 3) Comandos (fila) - sistema cria, ESP32 consome e atualiza status
create table if not exists cobrancas.gvt_iot_comandos (
  uid            uuid primary key default gen_random_uuid(),
  device_id      text not null references cobrancas.gvt_iot_dispositivos(device_id) on delete cascade,
  condominio_uid uuid null,
  tipo           text not null,
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'PENDING',
  erro           text null,
  requested_by   uuid null,
  created_at     timestamptz not null default now(),
  ack_at         timestamptz null,
  done_at        timestamptz null
);

alter table cobrancas.gvt_iot_comandos
  drop constraint if exists chk_gvt_iot_comandos_status;

alter table cobrancas.gvt_iot_comandos
  add constraint chk_gvt_iot_comandos_status
  check (status in ('PENDING','ACK','DONE','ERROR','EXPIRED'));

create index if not exists idx_gvt_iot_comandos_device_status_created
  on cobrancas.gvt_iot_comandos (device_id, status, created_at);

create index if not exists idx_gvt_iot_comandos_created
  on cobrancas.gvt_iot_comandos (created_at);

-- 4) Status (telemetria/eventos) - ESP32 escreve, sistema lê
create table if not exists cobrancas.gvt_iot_status (
  uid              uuid primary key default gen_random_uuid(),
  device_id        text not null references cobrancas.gvt_iot_dispositivos(device_id) on delete cascade,
  condominio_uid   uuid null,
  porta_numero     integer null,
  door_state       text not null default 'UNKNOWN',
  sensor_raw       integer null,
  last_command_uid uuid null,
  info             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

alter table cobrancas.gvt_iot_status
  drop constraint if exists chk_gvt_iot_status_door_state;

alter table cobrancas.gvt_iot_status
  add constraint chk_gvt_iot_status_door_state
  check (door_state in ('OPEN','CLOSED','UNKNOWN'));

create index if not exists idx_gvt_iot_status_device_created
  on cobrancas.gvt_iot_status (device_id, created_at desc);

create index if not exists idx_gvt_iot_status_last_command
  on cobrancas.gvt_iot_status (last_command_uid);

-- 5) Trigger para updated_at
create or replace function cobrancas.gvt_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gvt_iot_dispositivos_updated_at on cobrancas.gvt_iot_dispositivos;

create trigger trg_gvt_iot_dispositivos_updated_at
before update on cobrancas.gvt_iot_dispositivos
for each row execute function cobrancas.gvt_set_updated_at();
