\set ON_ERROR_STOP on

insert into public.external_api_keys (
  id,
  organization_id,
  name,
  key_hash,
  scopes
) values (
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'External API rate limit test',
  repeat('a', 64),
  array['attendance:read']
);

do $$
declare
  v_allowed boolean;
  v_remaining integer;
  v_reset_at timestamptz;
  v_index integer;
begin
  if has_table_privilege('anon', 'public.external_api_access_logs', 'select') then
    raise exception 'anon must not read external API access logs';
  end if;

  if has_table_privilege('authenticated', 'public.external_api_rate_limit_windows', 'select') then
    raise exception 'authenticated must not read rate limit windows';
  end if;

  if has_function_privilege(
    'anon',
    'public.consume_external_api_rate_limit(uuid,timestamptz)',
    'execute'
  ) then
    raise exception 'anon must not execute the rate limit function';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.consume_external_api_rate_limit(uuid,timestamptz)',
    'execute'
  ) then
    raise exception 'service_role must execute the rate limit function';
  end if;

  for v_index in 1..60 loop
    select result.allowed, result.remaining, result.reset_at
    into v_allowed, v_remaining, v_reset_at
    from public.consume_external_api_rate_limit(
      '50000000-0000-0000-0000-000000000001',
      '2026-07-16T06:00:30Z'
    ) as result;

    if not v_allowed or v_remaining <> 60 - v_index then
      raise exception 'unexpected rate limit result at request %', v_index;
    end if;
  end loop;

  select result.allowed, result.remaining, result.reset_at
  into v_allowed, v_remaining, v_reset_at
  from public.consume_external_api_rate_limit(
    '50000000-0000-0000-0000-000000000001',
    '2026-07-16T06:00:45Z'
  ) as result;

  if v_allowed or v_remaining <> 0 or v_reset_at <> '2026-07-16T06:01:00Z' then
    raise exception 'the 61st request must be rate limited';
  end if;

  select result.allowed, result.remaining, result.reset_at
  into v_allowed, v_remaining, v_reset_at
  from public.consume_external_api_rate_limit(
    '50000000-0000-0000-0000-000000000001',
    '2026-07-16T06:01:00Z'
  ) as result;

  if not v_allowed or v_remaining <> 59 or v_reset_at <> '2026-07-16T06:02:00Z' then
    raise exception 'a new minute must reset the counter';
  end if;
end;
$$;

begin;
set local role service_role;
insert into public.external_api_access_logs (key_id, endpoint, status_code)
values (
  '50000000-0000-0000-0000-000000000001',
  '/api/external/v1/health',
  200
);
commit;

do $$
begin
  if not exists (
    select 1
    from public.external_api_access_logs
    where key_id = '50000000-0000-0000-0000-000000000001'
      and endpoint = '/api/external/v1/health'
      and status_code = 200
      and at is not null
  ) then
    raise exception 'expected a persisted external API access log';
  end if;
end;
$$;

delete from public.external_api_rate_limit_windows
where key_id = '50000000-0000-0000-0000-000000000001';

\echo 'external API rate limit PostgreSQL tests passed'
