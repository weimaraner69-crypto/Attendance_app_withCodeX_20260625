-- Keep owner recovery links isolated from staff password intents and single-use.

begin;

create table public.owner_password_recovery_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);

create unique index idx_owner_password_recovery_intents_active_user
  on public.owner_password_recovery_intents (user_id)
  where consumed_at is null;

alter table public.owner_password_recovery_intents enable row level security;
revoke all on public.owner_password_recovery_intents from public, anon, authenticated;
grant select, insert, update, delete on public.owner_password_recovery_intents to service_role;

create table public.owner_password_recovery_rate_limit_windows (
  scope text not null check (scope in ('ip', 'email')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 21),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash)
);

alter table public.owner_password_recovery_rate_limit_windows enable row level security;
revoke all on public.owner_password_recovery_rate_limit_windows
  from public, anon, authenticated;
grant select, insert, update, delete on public.owner_password_recovery_rate_limit_windows
  to service_role;

create or replace function public.issue_owner_password_recovery_intent(
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if p_expires_at <= now() then
    raise exception 'owner password recovery intent expiry must be in the future';
  end if;

  if not exists (
    select 1
    from public.user_profiles profile
    join auth.users auth_user on auth_user.id = profile.id
    where profile.id = p_user_id
      and profile.role = 'owner'
      and profile.is_active = true
      and lower(btrim(profile.email)) = lower(btrim(coalesce(auth_user.email, '')))
  ) then
    raise exception 'owner password recovery identity is invalid';
  end if;

  update public.owner_password_recovery_intents
  set consumed_at = now()
  where user_id = p_user_id
    and consumed_at is null;

  insert into public.owner_password_recovery_intents (
    user_id,
    token_hash,
    expires_at
  ) values (
    p_user_id,
    p_token_hash,
    p_expires_at
  );
end;
$$;

revoke all on function public.issue_owner_password_recovery_intent(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.issue_owner_password_recovery_intent(uuid, text, timestamptz)
  to service_role;

create or replace function public.claim_owner_password_recovery_intent(
  p_token_hash text
)
returns table (id uuid, user_id uuid)
language sql
security definer
set search_path = ''
as $$
  update public.owner_password_recovery_intents intent
  set consumed_at = now()
  where intent.token_hash = p_token_hash
    and intent.consumed_at is null
    and intent.expires_at > now()
  returning intent.id, intent.user_id;
$$;

revoke all on function public.claim_owner_password_recovery_intent(text)
  from public, anon, authenticated;
grant execute on function public.claim_owner_password_recovery_intent(text)
  to service_role;

create or replace function public.consume_owner_password_recovery_rate_limit(
  p_ip_hash text,
  p_email_hash text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_started_at timestamptz;
  v_ip_count integer;
  v_email_count integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'owner password recovery rate limit hashes are invalid';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from p_now) / 900) * 900
  );

  perform pg_advisory_xact_lock(
    hashtextextended('owner-recovery-rate-limit:ip:' || p_ip_hash, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('owner-recovery-rate-limit:email:' || p_email_hash, 0)
  );

  insert into public.owner_password_recovery_rate_limit_windows (
    scope,
    subject_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    'ip',
    p_ip_hash,
    v_window_started_at,
    1,
    p_now
  )
  on conflict (scope, subject_hash) do update
  set window_started_at = case
        when excluded.window_started_at > public.owner_password_recovery_rate_limit_windows.window_started_at
          then excluded.window_started_at
        else public.owner_password_recovery_rate_limit_windows.window_started_at
      end,
      request_count = case
        when excluded.window_started_at > public.owner_password_recovery_rate_limit_windows.window_started_at
          then 1
        else least(public.owner_password_recovery_rate_limit_windows.request_count + 1, 21)
      end,
      updated_at = greatest(public.owner_password_recovery_rate_limit_windows.updated_at, excluded.updated_at)
  returning request_count into v_ip_count;

  insert into public.owner_password_recovery_rate_limit_windows (
    scope,
    subject_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    'email',
    p_email_hash,
    v_window_started_at,
    1,
    p_now
  )
  on conflict (scope, subject_hash) do update
  set window_started_at = case
        when excluded.window_started_at > public.owner_password_recovery_rate_limit_windows.window_started_at
          then excluded.window_started_at
        else public.owner_password_recovery_rate_limit_windows.window_started_at
      end,
      request_count = case
        when excluded.window_started_at > public.owner_password_recovery_rate_limit_windows.window_started_at
          then 1
        else least(public.owner_password_recovery_rate_limit_windows.request_count + 1, 6)
      end,
      updated_at = greatest(public.owner_password_recovery_rate_limit_windows.updated_at, excluded.updated_at)
  returning request_count into v_email_count;

  return v_ip_count <= 20 and v_email_count <= 5;
end;
$$;

revoke all on function public.consume_owner_password_recovery_rate_limit(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_owner_password_recovery_rate_limit(text, text, timestamptz)
  to service_role;

commit;
