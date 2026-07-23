create or replace function private.normalize_staff_auth_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(btrim(p_email)), '')
$$;

create or replace function private.assert_staff_auth_email_consistency()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_duplicate_groups bigint;
  profile_duplicate_groups bigint;
  staff_profile_conflicts bigint;
  linked_staff_conflicts bigint;
  invalid_profile_emails bigint;
begin
  select count(*) into staff_duplicate_groups
  from (
    select target_staff.organization_id, lower(btrim(target_staff.email))
    from public.staff target_staff
    where target_staff.email is not null
      and nullif(btrim(target_staff.email), '') is not null
    group by target_staff.organization_id, lower(btrim(target_staff.email))
    having count(*) > 1
  ) duplicate_staff;

  select count(*) into profile_duplicate_groups
  from (
    select lower(btrim(target_profile.email))
    from public.user_profiles target_profile
    group by lower(btrim(target_profile.email))
    having count(*) > 1
  ) duplicate_profiles;

  select count(*) into staff_profile_conflicts
  from public.staff target_staff
  join public.user_profiles target_profile
    on lower(btrim(target_profile.email)) = lower(btrim(target_staff.email))
  where target_staff.email is not null
    and nullif(btrim(target_staff.email), '') is not null
    and target_profile.id is distinct from target_staff.auth_user_id;

  select count(*) into linked_staff_conflicts
  from public.staff target_staff
  left join public.user_profiles target_profile
    on target_profile.id = target_staff.auth_user_id
  where target_staff.auth_user_id is not null
    and (
      target_profile.id is null
      or target_profile.organization_id is distinct from target_staff.organization_id
      or private.normalize_staff_auth_email(target_profile.email)
        is distinct from private.normalize_staff_auth_email(target_staff.email)
    );

  select count(*) into invalid_profile_emails
  from public.user_profiles target_profile
  where private.normalize_staff_auth_email(target_profile.email) is null;

  if staff_duplicate_groups > 0
    or profile_duplicate_groups > 0
    or staff_profile_conflicts > 0
    or linked_staff_conflicts > 0
    or invalid_profile_emails > 0 then
    raise check_violation using message = format(
      'staff Auth email preflight failed: staff_duplicate_groups=%s, profile_duplicate_groups=%s, staff_profile_conflicts=%s, linked_staff_conflicts=%s, invalid_profile_emails=%s',
      staff_duplicate_groups,
      profile_duplicate_groups,
      staff_profile_conflicts,
      linked_staff_conflicts,
      invalid_profile_emails
    );
  end if;
end;
$$;

select private.assert_staff_auth_email_consistency();

create table private.staff_auth_email_claims (
  normalized_email text primary key,
  organization_id uuid not null,
  staff_id uuid unique,
  staff_is_active boolean,
  auth_user_id uuid unique,
  check (normalized_email = private.normalize_staff_auth_email(normalized_email)),
  check (staff_id is not null or auth_user_id is not null),
  check (staff_id is not null or staff_is_active is null)
);

insert into private.staff_auth_email_claims (
  normalized_email,
  organization_id,
  auth_user_id
)
select
  private.normalize_staff_auth_email(target_profile.email),
  target_profile.organization_id,
  target_profile.id
from public.user_profiles target_profile;

update private.staff_auth_email_claims target_claim
set
  staff_id = target_staff.id,
  staff_is_active = target_staff.is_active
from public.staff target_staff
where target_staff.auth_user_id is not null
  and target_claim.auth_user_id = target_staff.auth_user_id;

insert into private.staff_auth_email_claims (
  normalized_email,
  organization_id,
  staff_id,
  staff_is_active
)
select
  private.normalize_staff_auth_email(target_staff.email),
  target_staff.organization_id,
  target_staff.id,
  target_staff.is_active
from public.staff target_staff
where target_staff.auth_user_id is null
  and private.normalize_staff_auth_email(target_staff.email) is not null;

alter table private.staff_auth_email_claims enable row level security;
revoke all on private.staff_auth_email_claims
  from public, anon, authenticated, service_role;

create or replace function private.guard_staff_auth_email_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_email text;
  requested_email text;
  changed_email text;
begin
  if tg_op = 'DELETE' then
    delete from private.staff_auth_email_claims
    where staff_id = old.id
      and auth_user_id is null;

    update private.staff_auth_email_claims
    set staff_id = null, staff_is_active = null
    where staff_id = old.id
      and auth_user_id is not null;
    return old;
  end if;

  requested_email := private.normalize_staff_auth_email(new.email);
  new.email := requested_email;

  if tg_op = 'UPDATE' then
    previous_email := private.normalize_staff_auth_email(old.email);
    if previous_email is distinct from requested_email
      or old.organization_id is distinct from new.organization_id then
      delete from private.staff_auth_email_claims
      where normalized_email = previous_email
        and staff_id = old.id
        and auth_user_id is null
      returning normalized_email into changed_email;

      if previous_email is not null and changed_email is null then
        raise unique_violation using message =
          'linked staff email or organization cannot be changed';
      end if;
    end if;
  end if;

  if requested_email is null then
    if new.auth_user_id is not null then
      raise check_violation using message = 'linked staff email is required';
    end if;
    return new;
  end if;

  changed_email := null;
  insert into private.staff_auth_email_claims (
    normalized_email,
    organization_id,
    staff_id,
    staff_is_active,
    auth_user_id
  ) values (
    requested_email,
    new.organization_id,
    new.id,
    new.is_active,
    new.auth_user_id
  )
  on conflict (normalized_email) do update
  set
    organization_id = excluded.organization_id,
    staff_id = excluded.staff_id,
    staff_is_active = excluded.staff_is_active,
    auth_user_id = coalesce(
      private.staff_auth_email_claims.auth_user_id,
      excluded.auth_user_id
    )
  where private.staff_auth_email_claims.organization_id = excluded.organization_id
    and (
      private.staff_auth_email_claims.staff_id is null
      or private.staff_auth_email_claims.staff_id = excluded.staff_id
    )
    and (
      private.staff_auth_email_claims.auth_user_id is null
      or private.staff_auth_email_claims.auth_user_id = excluded.auth_user_id
    )
  returning normalized_email into changed_email;

  if changed_email is null then
    raise unique_violation using message = 'staff Auth email is already claimed';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_staff_auth_email_claim on public.staff;
create trigger guard_staff_auth_email_claim
before insert or update of email, organization_id, is_active or delete on public.staff
for each row execute function private.guard_staff_auth_email_claim();

create or replace function private.guard_user_profile_email_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_email text;
  requested_email text := private.normalize_staff_auth_email(new.email);
  changed_email text;
begin
  if requested_email is null then
    raise check_violation using message = 'user profile email is required';
  end if;
  new.email := requested_email;

  if tg_op = 'UPDATE' then
    previous_email := private.normalize_staff_auth_email(old.email);
    if previous_email is distinct from requested_email
      or old.organization_id is distinct from new.organization_id then
      delete from private.staff_auth_email_claims
      where normalized_email = previous_email
        and auth_user_id = old.id
        and staff_id is null
      returning normalized_email into changed_email;

      if previous_email is not null and changed_email is null then
        raise unique_violation using message = 'linked staff profile email cannot be changed';
      end if;
    end if;
  end if;

  changed_email := null;
  if new.role = 'staff' then
    update private.staff_auth_email_claims
    set auth_user_id = new.id
    where private.staff_auth_email_claims.normalized_email = requested_email
      and organization_id = new.organization_id
      and staff_id is not null
      and staff_is_active
      and auth_user_id = new.id
    returning private.staff_auth_email_claims.normalized_email into changed_email;
  else
    insert into private.staff_auth_email_claims (
      normalized_email,
      organization_id,
      auth_user_id
    ) values (
      requested_email,
      new.organization_id,
      new.id
    )
    on conflict (normalized_email) do update
    set
      organization_id = excluded.organization_id,
      auth_user_id = excluded.auth_user_id
    where private.staff_auth_email_claims.staff_id is null
      and (
        private.staff_auth_email_claims.auth_user_id is null
        or private.staff_auth_email_claims.auth_user_id = excluded.auth_user_id
      )
    returning private.staff_auth_email_claims.normalized_email into changed_email;
  end if;

  if changed_email is null then
    raise unique_violation using message = 'user profile email is already claimed';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_user_profile_email_claim on public.user_profiles;
create trigger guard_user_profile_email_claim
before insert or update of email, organization_id, role on public.user_profiles
for each row execute function private.guard_user_profile_email_claim();

create or replace function private.release_user_profile_email_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.staff_auth_email_claims
  where auth_user_id = old.id
    and staff_id is null;

  update private.staff_auth_email_claims
  set auth_user_id = null
  where auth_user_id = old.id
    and staff_id is not null;
  return old;
end;
$$;

drop trigger if exists release_user_profile_email_claim on public.user_profiles;
create trigger release_user_profile_email_claim
after delete on public.user_profiles
for each row execute function private.release_user_profile_email_claim();

create or replace function public.create_staff_profile_with_email_guard(
  p_user_id uuid,
  p_staff_id uuid,
  p_organization_id uuid,
  p_display_name text,
  p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_email text := private.normalize_staff_auth_email(p_email);
  claimed_email text;
begin
  if requested_email is null or nullif(btrim(p_display_name), '') is null then
    return false;
  end if;

  update private.staff_auth_email_claims
  set auth_user_id = p_user_id
  where private.staff_auth_email_claims.normalized_email = requested_email
    and organization_id = p_organization_id
    and staff_id = p_staff_id
    and staff_is_active
    and auth_user_id is null
  returning private.staff_auth_email_claims.normalized_email into claimed_email;

  if claimed_email is null then
    return false;
  end if;

  insert into public.user_profiles (
    id,
    organization_id,
    role,
    display_name,
    email,
    is_active
  ) values (
    p_user_id,
    p_organization_id,
    'staff',
    btrim(p_display_name),
    requested_email,
    true
  );

  return true;
exception
  when unique_violation or foreign_key_violation then
    return false;
end;
$$;

revoke execute on function private.normalize_staff_auth_email(text)
  from public, anon, authenticated, service_role;
revoke execute on function private.assert_staff_auth_email_consistency()
  from public, anon, authenticated, service_role;
revoke execute on function private.guard_staff_auth_email_claim()
  from public, anon, authenticated, service_role;
revoke execute on function private.guard_user_profile_email_claim()
  from public, anon, authenticated, service_role;
revoke execute on function private.release_user_profile_email_claim()
  from public, anon, authenticated, service_role;

revoke all on function public.create_staff_profile_with_email_guard(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.create_staff_profile_with_email_guard(
  uuid, uuid, uuid, text, text
) to service_role;
