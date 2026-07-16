-- Add server-only fixed-window rate limiting and access logs for external APIs.

begin;

create table public.external_api_rate_limit_windows (
  key_id uuid primary key references public.external_api_keys(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);

alter table public.external_api_rate_limit_windows enable row level security;
revoke all on public.external_api_rate_limit_windows from public, anon, authenticated;
grant select, insert, update, delete on public.external_api_rate_limit_windows to service_role;

create table public.external_api_access_logs (
  id bigint generated always as identity primary key,
  key_id uuid not null references public.external_api_keys(id) on delete restrict,
  endpoint text not null check (
    endpoint = '/api/external/v1' or endpoint like '/api/external/v1/%'
  ),
  status_code smallint not null check (status_code between 100 and 599),
  at timestamptz not null default now()
);

create index idx_external_api_access_logs_key_at
  on public.external_api_access_logs (key_id, at desc);

create index idx_external_api_access_logs_at
  on public.external_api_access_logs (at desc);

alter table public.external_api_access_logs enable row level security;
revoke all on public.external_api_access_logs from public, anon, authenticated;
grant select, insert on public.external_api_access_logs to service_role;
revoke all on sequence public.external_api_access_logs_id_seq
  from public, anon, authenticated;
grant usage, select on sequence public.external_api_access_logs_id_seq
  to service_role;

create or replace function public.consume_external_api_rate_limit(
  p_key_id uuid,
  p_now timestamptz default clock_timestamp()
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language sql
volatile
security definer
set search_path = ''
as $$
  with consumed as (
    insert into public.external_api_rate_limit_windows (
      key_id,
      window_started_at,
      request_count,
      updated_at
    ) values (
      p_key_id,
      date_trunc('minute', p_now),
      1,
      p_now
    )
    on conflict (key_id) do update
    set
      window_started_at = case
        when public.external_api_rate_limit_windows.window_started_at = excluded.window_started_at
          then public.external_api_rate_limit_windows.window_started_at
        else excluded.window_started_at
      end,
      request_count = case
        when public.external_api_rate_limit_windows.window_started_at = excluded.window_started_at
          then public.external_api_rate_limit_windows.request_count + 1
        else 1
      end,
      updated_at = excluded.updated_at
    returning request_count, window_started_at
  )
  select
    consumed.request_count <= 60,
    greatest(60 - consumed.request_count, 0),
    consumed.window_started_at + interval '1 minute'
  from consumed;
$$;

revoke all on function public.consume_external_api_rate_limit(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_external_api_rate_limit(uuid, timestamptz)
  to service_role;

commit;
