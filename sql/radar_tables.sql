create table if not exists telemetry_latest (
  device_id text primary key,
  updated_at timestamptz default now(),
  radar_target_count int,
  radar_speed numeric,
  radar_distance numeric,
  radar_x numeric,
  radar_y numeric,
  radar_alert boolean,
  env_temperature numeric,
  env_humidity numeric,
  env_pressure numeric,
  env_altitude numeric,
  net_latency numeric,
  net_link text,
  camera_status text,
  camera_alert boolean,
  camera_image_url text,
  camera_updated_at timestamptz
);

alter table telemetry_latest add column if not exists radar_x numeric;
alter table telemetry_latest add column if not exists radar_y numeric;
alter table telemetry_latest add column if not exists env_temperature numeric;
alter table telemetry_latest add column if not exists env_humidity numeric;
alter table telemetry_latest add column if not exists env_pressure numeric;
alter table telemetry_latest add column if not exists env_altitude numeric;
alter table telemetry_latest add column if not exists net_latency numeric;
alter table telemetry_latest add column if not exists net_link text;
alter table telemetry_latest add column if not exists camera_status text;
alter table telemetry_latest add column if not exists camera_alert boolean;
alter table telemetry_latest add column if not exists camera_image_url text;
alter table telemetry_latest add column if not exists camera_updated_at timestamptz;

create table if not exists radar_logs (
  id bigint generated always as identity primary key,
  device_id text,
  created_at timestamptz default now(),
  target_count int,
  speed numeric,
  distance numeric,
  x numeric,
  y numeric,
  alert boolean
);

alter table radar_logs add column if not exists x numeric;
alter table radar_logs add column if not exists y numeric;
