-- Address Supabase Advisor warnings without changing application behavior.
-- Apply from the Supabase SQL Editor or Supabase CLI, then rerun the Advisors.

begin;

create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension
    join pg_namespace on pg_namespace.oid = pg_extension.extnamespace
    where pg_extension.extname = 'pgcrypto'
      and pg_namespace.nspname <> 'extensions'
  ) then
    alter extension pgcrypto set schema extensions;
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- These tables are intentionally server-only. The service role bypasses RLS,
-- while browser clients get explicit deny policies instead of implicit silence.
-- Some production databases may not have every feature migration applied yet,
-- so each policy is guarded by table and policy existence checks.
do $$
begin
  if to_regclass('public.external_api_keys') is not null
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'external_api_keys'
        and policyname = 'deny client access to external api keys'
    )
  then
    execute '
      create policy "deny client access to external api keys"
      on public.external_api_keys
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false)
    ';
  end if;

  if to_regclass('public.line_link_tokens') is not null
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'line_link_tokens'
        and policyname = 'deny client access to line link tokens'
    )
  then
    execute '
      create policy "deny client access to line link tokens"
      on public.line_link_tokens
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false)
    ';
  end if;

  if to_regclass('public.user_login_pins') is not null
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'user_login_pins'
        and policyname = 'deny client access to user login pins'
    )
  then
    execute '
      create policy "deny client access to user login pins"
      on public.user_login_pins
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false)
    ';
  end if;
end;
$$;

-- FK helper indexes for Advisor warnings and faster cascades/joins.
create index if not exists idx_staff_default_store_id
  on public.staff (default_store_id)
  where default_store_id is not null;

create index if not exists idx_store_staff_assignments_staff_id
  on public.store_staff_assignments (staff_id);

create index if not exists idx_manager_store_permissions_store_id
  on public.manager_store_permissions (store_id);

create index if not exists idx_sr_organization_permissions_user_id
  on public.sr_organization_permissions (user_id);

create index if not exists idx_attendance_events_store_time
  on public.attendance_events (store_id, occurred_at desc);

create index if not exists idx_attendance_events_auth_user_id
  on public.attendance_events (auth_user_id)
  where auth_user_id is not null;

create index if not exists idx_attendance_events_kiosk_device_id
  on public.attendance_events (kiosk_device_id)
  where kiosk_device_id is not null;

create index if not exists idx_attendance_events_line_account_id
  on public.attendance_events (line_account_id)
  where line_account_id is not null;

create index if not exists idx_attendance_events_created_by_user_id
  on public.attendance_events (created_by_user_id)
  where created_by_user_id is not null;

create index if not exists idx_attendance_requests_attendance_record_id
  on public.attendance_requests (attendance_record_id)
  where attendance_record_id is not null;

create index if not exists idx_attendance_requests_reviewed_by_user_id
  on public.attendance_requests (reviewed_by_user_id)
  where reviewed_by_user_id is not null;

create index if not exists idx_shifts_created_by_user_id
  on public.shifts (created_by_user_id)
  where created_by_user_id is not null;

create index if not exists idx_shift_submission_windows_store_id
  on public.shift_submission_windows (store_id)
  where store_id is not null;

create index if not exists idx_shift_submission_windows_created_by_user_id
  on public.shift_submission_windows (created_by_user_id)
  where created_by_user_id is not null;

create index if not exists idx_shift_submissions_line_account_id
  on public.shift_submissions (line_account_id)
  where line_account_id is not null;

create index if not exists idx_shift_submissions_reviewed_by_user_id
  on public.shift_submissions (reviewed_by_user_id)
  where reviewed_by_user_id is not null;

create index if not exists idx_audit_logs_actor_user_id
  on public.audit_logs (actor_user_id)
  where actor_user_id is not null;

create index if not exists idx_audit_logs_actor_line_account_id
  on public.audit_logs (actor_line_account_id)
  where actor_line_account_id is not null;

commit;
