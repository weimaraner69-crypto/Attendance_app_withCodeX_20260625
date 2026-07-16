create or replace function private.normalize_staff_auth_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(btrim(p_email)), '')
$$;

create or replace function private.lock_staff_auth_emails(
  p_first_email text,
  p_second_email text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  first_email text := private.normalize_staff_auth_email(p_first_email);
  second_email text := private.normalize_staff_auth_email(p_second_email);
begin
  if first_email is null and second_email is null then
    return;
  end if;

  if first_email is null or first_email = second_email then
    perform pg_advisory_xact_lock(
      hashtextextended('staff-auth-email:' || second_email, 0)
    );
  elsif second_email is null then
    perform pg_advisory_xact_lock(
      hashtextextended('staff-auth-email:' || first_email, 0)
    );
  elsif first_email < second_email then
    perform pg_advisory_xact_lock(
      hashtextextended('staff-auth-email:' || first_email, 0)
    );
    perform pg_advisory_xact_lock(
      hashtextextended('staff-auth-email:' || second_email, 0)
    );
  else
    perform pg_advisory_xact_lock(
      hashtextextended('staff-auth-email:' || second_email, 0)
    );
    perform pg_advisory_xact_lock(
      hashtextextended('staff-auth-email:' || first_email, 0)
    );
  end if;
end;
$$;

create or replace function private.guard_staff_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := private.normalize_staff_auth_email(new.email);
  previous_email text := case
    when tg_op = 'UPDATE' then private.normalize_staff_auth_email(old.email)
    else null
  end;
begin
  new.email := normalized_email;
  perform private.lock_staff_auth_emails(previous_email, normalized_email);

  if normalized_email is null then
    return new;
  end if;

  if exists (
    select 1
    from public.staff existing_staff
    where existing_staff.organization_id = new.organization_id
      and existing_staff.id is distinct from new.id
      and private.normalize_staff_auth_email(existing_staff.email) = normalized_email
  ) then
    raise unique_violation using message = 'staff email is already assigned';
  end if;

  if exists (
    select 1
    from public.user_profiles existing_profile
    where private.normalize_staff_auth_email(existing_profile.email) = normalized_email
      and existing_profile.id is distinct from new.auth_user_id
  ) then
    raise unique_violation using message = 'staff email is already registered';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_staff_auth_email on public.staff;
create trigger guard_staff_auth_email
before insert or update of email on public.staff
for each row execute function private.guard_staff_auth_email();

create index if not exists idx_staff_organization_normalized_email
  on public.staff (organization_id, lower(btrim(email)))
  where email is not null;

create index if not exists idx_user_profiles_normalized_email
  on public.user_profiles (lower(btrim(email)));

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
  normalized_email text := private.normalize_staff_auth_email(p_email);
begin
  if normalized_email is null or nullif(btrim(p_display_name), '') is null then
    return false;
  end if;

  perform private.lock_staff_auth_emails(normalized_email);

  if exists (
    select 1
    from public.user_profiles existing_profile
    where private.normalize_staff_auth_email(existing_profile.email) = normalized_email
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.staff target_staff
    where target_staff.id = p_staff_id
      and target_staff.organization_id = p_organization_id
      and target_staff.auth_user_id is null
      and target_staff.is_active
      and private.normalize_staff_auth_email(target_staff.email) = normalized_email
  ) then
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
    normalized_email,
    true
  );

  return true;
exception
  when unique_violation or foreign_key_violation then
    return false;
end;
$$;

revoke execute on function private.normalize_staff_auth_email(text)
  from public, anon, authenticated;
revoke execute on function private.lock_staff_auth_emails(text, text)
  from public, anon, authenticated;
revoke execute on function private.guard_staff_auth_email()
  from public, anon, authenticated;

revoke all on function public.create_staff_profile_with_email_guard(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.create_staff_profile_with_email_guard(
  uuid, uuid, uuid, text, text
) to service_role;
