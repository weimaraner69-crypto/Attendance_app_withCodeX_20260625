-- Keep owner recovery links isolated from staff password intents and single-use.

begin;

create table public.owner_password_recovery_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  claim_id uuid,
  claimed_at timestamptz,
  consumed_at timestamptz,
  recovery_outcome text check (
    recovery_outcome in ('updated', 'identity_changed', 'update_unknown', 'superseded')
  ),
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at),
  check ((claim_id is null) = (claimed_at is null)),
  check (recovery_outcome is null or consumed_at is not null)
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

create index idx_owner_password_recovery_rate_limit_windows_updated_at
  on public.owner_password_recovery_rate_limit_windows (updated_at);

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
  perform pg_advisory_xact_lock(
    hashtextextended('owner-password-recovery:' || p_user_id::text, 0)
  );

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

  if exists (
    select 1
    from public.owner_password_recovery_intents intent
    where intent.user_id = p_user_id
      and intent.consumed_at is null
      and intent.claim_id is not null
      and intent.expires_at > now()
  ) then
    raise exception 'owner password recovery is already in progress';
  end if;

  update public.owner_password_recovery_intents
  set consumed_at = now(),
      recovery_outcome = 'superseded'
  where user_id = p_user_id
    and consumed_at is null
    and claim_id is null;

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
  p_token_hash text,
  p_claim_id uuid
)
returns table (id uuid, user_id uuid, claim_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_claim_id is null then
    raise exception 'owner password recovery claim id is required';
  end if;

  select intent.user_id into v_user_id
  from public.owner_password_recovery_intents intent
  where intent.token_hash = p_token_hash
    and intent.consumed_at is null
    and intent.claim_id is null
    and intent.expires_at > now();

  if v_user_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('owner-password-recovery:' || v_user_id::text, 0)
  );

  if exists (
    select 1
    from public.owner_password_recovery_intents intent
    where intent.token_hash = p_token_hash
      and intent.user_id = v_user_id
      and intent.consumed_at is null
      and intent.claim_id is not null
      and intent.expires_at > now()
  ) then
    return query
    select intent.id, intent.user_id, 'busy'::text
    from public.owner_password_recovery_intents intent
    where intent.token_hash = p_token_hash
      and intent.user_id = v_user_id
      and intent.consumed_at is null
      and intent.claim_id is not null
      and intent.expires_at > now();
    return;
  end if;

  return query
  update public.owner_password_recovery_intents intent
  set claim_id = p_claim_id,
      claimed_at = now()
  where intent.token_hash = p_token_hash
    and intent.user_id = v_user_id
    and intent.consumed_at is null
    and intent.claim_id is null
    and intent.expires_at > now()
    and exists (
      select 1
      from public.user_profiles profile
      join auth.users auth_user on auth_user.id = profile.id
      where profile.id = intent.user_id
        and profile.role = 'owner'
        and profile.is_active = true
        and lower(btrim(profile.email)) = lower(btrim(coalesce(auth_user.email, '')))
    )
  returning intent.id, intent.user_id, 'claimed'::text;
end;
$$;

revoke all on function public.claim_owner_password_recovery_intent(text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_owner_password_recovery_intent(text, uuid)
  to service_role;

create or replace function public.release_owner_password_recovery_claim(
  p_intent_id uuid,
  p_claim_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select intent.user_id into v_user_id
  from public.owner_password_recovery_intents intent
  where intent.id = p_intent_id
    and intent.claim_id = p_claim_id
    and intent.consumed_at is null;

  if v_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('owner-password-recovery:' || v_user_id::text, 0)
  );

  update public.owner_password_recovery_intents intent
  set claim_id = null,
      claimed_at = null
  where intent.id = p_intent_id
    and intent.claim_id = p_claim_id
    and intent.consumed_at is null;

  return found;
end;
$$;

revoke all on function public.release_owner_password_recovery_claim(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_owner_password_recovery_claim(uuid, uuid)
  to service_role;

create or replace function public.finalize_owner_password_recovery_claim(
  p_intent_id uuid,
  p_claim_id uuid,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_outcome not in ('updated', 'identity_changed', 'update_unknown') then
    raise exception 'owner password recovery outcome is invalid';
  end if;

  select intent.user_id into v_user_id
  from public.owner_password_recovery_intents intent
  where intent.id = p_intent_id
    and intent.claim_id = p_claim_id
    and intent.consumed_at is null;

  if v_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('owner-password-recovery:' || v_user_id::text, 0)
  );

  update public.owner_password_recovery_intents intent
  set consumed_at = now(),
      recovery_outcome = p_outcome
  where intent.id = p_intent_id
    and intent.claim_id = p_claim_id
    and intent.consumed_at is null;

  return found;
end;
$$;

revoke all on function public.finalize_owner_password_recovery_claim(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_owner_password_recovery_claim(uuid, uuid, text)
  to service_role;

create or replace function public.quarantine_owner_password_recovery_claim(
  p_intent_id uuid,
  p_claim_id uuid,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_outcome not in ('identity_changed', 'update_unknown') then
    raise exception 'owner password recovery quarantine outcome is invalid';
  end if;

  select intent.user_id into v_user_id
  from public.owner_password_recovery_intents intent
  where intent.id = p_intent_id
    and intent.claim_id = p_claim_id
    and intent.consumed_at is null;

  if v_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('owner-password-recovery:' || v_user_id::text, 0)
  );

  update public.owner_password_recovery_intents intent
  set consumed_at = now(),
      recovery_outcome = p_outcome
  where intent.id = p_intent_id
    and intent.claim_id = p_claim_id
    and intent.consumed_at is null;

  if not found then
    return false;
  end if;

  update public.user_profiles profile
  set is_active = false
  where profile.id = v_user_id
    and profile.is_active = true;

  return true;
end;
$$;

revoke all on function public.quarantine_owner_password_recovery_claim(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.quarantine_owner_password_recovery_claim(uuid, uuid, text)
  to service_role;

create or replace function private.guard_owner_password_recovery_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('owner-password-recovery:' || old.id::text, 0)
  );

  if exists (
    select 1
    from public.owner_password_recovery_intents intent
    where intent.user_id = old.id
      and intent.claim_id is not null
      and intent.consumed_at is null
      and intent.expires_at > now()
  ) then
    raise exception 'owner profile change blocked during password recovery';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_owner_password_recovery_claim on public.user_profiles;
create trigger guard_owner_password_recovery_claim
before update of email, role, is_active or delete on public.user_profiles
for each row execute function private.guard_owner_password_recovery_claim();

revoke execute on function private.guard_owner_password_recovery_claim()
  from public, anon, authenticated, service_role;

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

  delete from public.owner_password_recovery_rate_limit_windows
  where (scope, subject_hash) in (
    select rate_window.scope, rate_window.subject_hash
    from public.owner_password_recovery_rate_limit_windows rate_window
    where rate_window.updated_at < p_now - interval '1 day'
    order by rate_window.updated_at
    limit 100
  );

  perform pg_advisory_xact_lock(
    hashtextextended('owner-recovery-rate-limit:ip:' || p_ip_hash, 0)
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

  if v_ip_count > 20 then
    return false;
  end if;

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

  return v_email_count <= 5;
end;
$$;

revoke all on function public.consume_owner_password_recovery_rate_limit(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_owner_password_recovery_rate_limit(text, text, timestamptz)
  to service_role;

commit;
