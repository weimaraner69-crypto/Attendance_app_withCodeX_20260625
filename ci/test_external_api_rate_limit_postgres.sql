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
  v_operation text;
  v_role text;
  v_table text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_table in array array[
      'public.external_api_access_logs',
      'public.external_api_rate_limit_windows'
    ] loop
      foreach v_operation in array array['select', 'insert', 'update', 'delete'] loop
        if has_table_privilege(v_role, v_table, v_operation) then
          raise exception '% must not have % on %', v_role, v_operation, v_table;
        end if;
      end loop;
    end loop;

    if has_sequence_privilege(
      v_role,
      'public.external_api_access_logs_id_seq',
      'usage'
    ) or has_sequence_privilege(
      v_role,
      'public.external_api_access_logs_id_seq',
      'select'
    ) then
      raise exception '% must not access the access-log identity sequence', v_role;
    end if;

    if has_function_privilege(
      v_role,
      'public.consume_external_api_rate_limit(uuid,timestamptz)',
      'execute'
    ) then
      raise exception '% must not execute the rate limit function', v_role;
    end if;
  end loop;

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
    '2026-07-16T06:00:50Z'
  ) as result;

  if v_allowed or v_remaining <> 0 then
    raise exception 'requests above 61 must remain rate limited';
  end if;

  if (
    select request_count
    from public.external_api_rate_limit_windows
    where key_id = '50000000-0000-0000-0000-000000000001'
  ) <> 61 then
    raise exception 'the rejected counter must saturate at 61';
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

  select result.allowed, result.remaining, result.reset_at
  into v_allowed, v_remaining, v_reset_at
  from public.consume_external_api_rate_limit(
    '50000000-0000-0000-0000-000000000001',
    '2026-07-16T06:00:59Z'
  ) as result;

  if not v_allowed or v_remaining <> 58 or v_reset_at <> '2026-07-16T06:02:00Z' then
    raise exception 'a delayed old-window request must not roll the window back';
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

insert into public.external_api_access_logs (
  key_id,
  endpoint,
  status_code,
  rate_limit_window_started_at
) values (
  '50000000-0000-0000-0000-000000000001',
  '/api/external/v1/health',
  429,
  '2026-07-16T06:01:00Z'
)
on conflict (
  key_id,
  endpoint,
  status_code,
  rate_limit_window_started_at
) do nothing;

insert into public.external_api_access_logs (
  key_id,
  endpoint,
  status_code,
  rate_limit_window_started_at
) values (
  '50000000-0000-0000-0000-000000000001',
  '/api/external/v1/health',
  429,
  '2026-07-16T06:01:00Z'
)
on conflict (
  key_id,
  endpoint,
  status_code,
  rate_limit_window_started_at
) do nothing;
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

  if (
    select count(*)
    from public.external_api_access_logs
    where key_id = '50000000-0000-0000-0000-000000000001'
      and endpoint = '/api/external/v1/health'
      and status_code = 429
      and rate_limit_window_started_at = '2026-07-16T06:01:00Z'
  ) <> 1 then
    raise exception 'rate-limited logs must aggregate to one row per endpoint/window';
  end if;
end;
$$;

delete from public.external_api_rate_limit_windows
where key_id = '50000000-0000-0000-0000-000000000001';

\echo 'external API rate limit PostgreSQL tests passed'
