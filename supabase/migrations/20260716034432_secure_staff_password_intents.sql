-- Keep staff Auth links tenant-consistent and make password intents single-use.

begin;

alter table public.user_profiles
  add constraint user_profiles_id_organization_key
  unique (id, organization_id);

alter table public.staff
  add constraint staff_auth_user_organization_fk
  foreign key (auth_user_id, organization_id)
  references public.user_profiles (id, organization_id)
  on update restrict
  on delete no action
  deferrable initially deferred;

create table public.staff_password_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  intent_type text not null check (intent_type in ('invite', 'recovery')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);

create unique index idx_staff_password_intents_active_user
  on public.staff_password_intents (user_id)
  where consumed_at is null;

alter table public.staff_password_intents enable row level security;
revoke all on public.staff_password_intents from public, anon, authenticated;
grant select, insert, update, delete on public.staff_password_intents to service_role;

create or replace function public.issue_staff_password_intent(
  p_user_id uuid,
  p_token_hash text,
  p_intent_type text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_expires_at <= now() then
    raise exception 'password intent expiry must be in the future';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  update public.staff_password_intents
  set consumed_at = now()
  where user_id = p_user_id
    and consumed_at is null;

  insert into public.staff_password_intents (
    user_id,
    token_hash,
    intent_type,
    expires_at
  ) values (
    p_user_id,
    p_token_hash,
    p_intent_type,
    p_expires_at
  );
end;
$$;

revoke all on function public.issue_staff_password_intent(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.issue_staff_password_intent(uuid, text, text, timestamptz)
  to service_role;

drop policy if exists "organization members or staff can read staff" on public.staff;
create policy "organization members or staff can read staff"
on public.staff for select
using (
  organization_id = private.current_user_organization_id()
  or (
    auth_user_id = (select auth.uid())
    and organization_id = private.current_user_organization_id()
  )
);

drop policy if exists "store scoped users can read attendance records"
  on public.attendance_records;
create policy "store scoped users can read attendance records"
on public.attendance_records for select
using (
  private.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = attendance_records.staff_id
      and own_staff.auth_user_id = (select auth.uid())
      and own_staff.organization_id = private.current_user_organization_id()
  )
);

drop policy if exists "store scoped users can read attendance events"
  on public.attendance_events;
create policy "store scoped users can read attendance events"
on public.attendance_events for select
using (
  private.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = attendance_events.staff_id
      and own_staff.auth_user_id = (select auth.uid())
      and own_staff.organization_id = private.current_user_organization_id()
  )
);

drop policy if exists "store scoped users can read attendance requests"
  on public.attendance_requests;
create policy "store scoped users can read attendance requests"
on public.attendance_requests for select
using (
  private.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = attendance_requests.staff_id
      and own_staff.auth_user_id = (select auth.uid())
      and own_staff.organization_id = private.current_user_organization_id()
  )
);

drop policy if exists "store scoped users can read shifts" on public.shifts;
create policy "store scoped users can read shifts"
on public.shifts for select
using (
  private.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = shifts.staff_id
      and own_staff.auth_user_id = (select auth.uid())
      and own_staff.organization_id = private.current_user_organization_id()
  )
);

drop policy if exists "organization members can read shift submissions"
  on public.shift_submissions;
create policy "organization members can read shift submissions"
on public.shift_submissions for select
using (
  organization_id = private.current_user_organization_id()
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = shift_submissions.staff_id
      and own_staff.auth_user_id = (select auth.uid())
      and own_staff.organization_id = private.current_user_organization_id()
  )
);

drop policy if exists "organization members can read shift submission items"
  on public.shift_submission_items;
create policy "organization members can read shift submission items"
on public.shift_submission_items for select
using (
  organization_id = private.current_user_organization_id()
  or exists (
    select 1
    from public.shift_submissions submission
    join public.staff own_staff on own_staff.id = submission.staff_id
    where submission.id = shift_submission_items.submission_id
      and own_staff.auth_user_id = (select auth.uid())
      and own_staff.organization_id = private.current_user_organization_id()
  )
);

drop policy if exists "organization members can read own notifications"
  on public.notifications;
create policy "organization members can read own notifications"
on public.notifications for select
using (
  organization_id = private.current_user_organization_id()
  and (
    recipient_user_id = (select auth.uid())
    or exists (
      select 1
      from public.staff own_staff
      where own_staff.id = notifications.recipient_staff_id
        and own_staff.auth_user_id = (select auth.uid())
        and own_staff.organization_id = private.current_user_organization_id()
    )
    or private.current_user_role() in ('owner', 'manager')
  )
);

commit;
