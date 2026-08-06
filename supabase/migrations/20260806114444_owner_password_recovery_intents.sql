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

commit;
