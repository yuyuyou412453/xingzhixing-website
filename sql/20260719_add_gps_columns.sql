-- Add GPS fields to an existing telemetry_latest table.
-- Safe to run repeatedly in the Supabase SQL Editor.
alter table public.telemetry_latest
  add column if not exists gps_lat numeric,
  add column if not exists gps_lon numeric,
  add column if not exists gps_alt numeric,
  add column if not exists gps_fix_quality integer,
  add column if not exists gps_satellites integer;

select device_id,
       gps_lat,
       gps_lon,
       gps_alt,
       gps_fix_quality,
       gps_satellites,
       updated_at
from public.telemetry_latest
order by updated_at desc
limit 20;
