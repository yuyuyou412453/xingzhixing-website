alter table telemetry_latest add column if not exists manual_alert boolean default false;
alter table telemetry_latest add column if not exists manual_updated_at timestamptz;
alter table telemetry_latest add column if not exists manual_clear_until timestamptz;
