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
  rate_limit_window_started_at timestamptz,
  at timestamptz not null default now(),
  check (
    (status_code = 429 and rate_limit_window_started_at is not null)
    or (status_code <> 429 and rate_limit_window_started_at is null)
  )
);

create index idx_external_api_access_logs_key_at
  on public.external_api_access_logs (key_id, at desc);

create index idx_external_api_access_logs_at
  on public.external_api_access_logs (at desc);

create unique index idx_external_api_access_logs_rate_limited_window
  on public.external_api_access_logs (
    key_id,
    endpoint,
    status_code,
    rate_limit_window_started_at
  );

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
        when excluded.window_started_at > public.external_api_rate_limit_windows.window_started_at
          then excluded.window_started_at
        else public.external_api_rate_limit_windows.window_started_at
      end,
      request_count = case
        when excluded.window_started_at > public.external_api_rate_limit_windows.window_started_at
          then 1
        else least(public.external_api_rate_limit_windows.request_count + 1, 61)
      end,
      updated_at = greatest(
        public.external_api_rate_limit_windows.updated_at,
        excluded.updated_at
      )
    where
      excluded.window_started_at > public.external_api_rate_limit_windows.window_started_at
      or public.external_api_rate_limit_windows.request_count < 61
    returning request_count, window_started_at
  ), current_state as (
    select consumed.request_count, consumed.window_started_at
    from consumed
    union all
    select windows.request_count, windows.window_started_at
    from public.external_api_rate_limit_windows as windows
    where windows.key_id = p_key_id
      and not exists (select 1 from consumed)
    limit 1
  )
  select
    current_state.request_count <= 60,
    greatest(60 - current_state.request_count, 0),
    current_state.window_started_at + interval '1 minute'
  from current_state;
$$;

revoke all on function public.consume_external_api_rate_limit(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_external_api_rate_limit(uuid, timestamptz)
  to service_role;

commit;
