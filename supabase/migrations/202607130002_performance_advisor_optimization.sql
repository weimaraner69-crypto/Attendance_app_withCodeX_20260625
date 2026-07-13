-- Reduce Performance Advisor findings without widening existing RLS access.
-- Apply only after reviewing the policy diff and running role-based smoke tests.

begin;

-- Merge the two staff SELECT policies while preserving their logical union.
drop policy if exists "organization members can read staff" on public.staff;
drop policy if exists "staff can read own staff profile" on public.staff;
drop policy if exists "organization members or staff can read staff" on public.staff;

create policy "organization members or staff can read staff"
on public.staff for select
using (
  organization_id = private.current_user_organization_id()
  or auth_user_id = (select auth.uid())
);

-- Cache auth.uid() once per statement in policies reported by the Advisor.
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
    )
    or private.current_user_role() in ('owner', 'manager')
  )
);

-- FOR ALL overlaps SELECT policies. Split management access by command while
-- keeping the same USING and WITH CHECK predicates.
do $$
declare
  policy_record record;
  condition_sql text;
begin
  for policy_record in
    select *
    from (
      values
        ('user_profiles', 'owners can manage profiles', 'owner_org'),
        ('stores', 'owners can manage stores', 'owner_org'),
        ('manager_store_permissions', 'owners can manage manager store permissions', 'owner_org'),
        ('sr_organization_permissions', 'owners can manage sr organization permissions', 'owner_org'),
        ('staff', 'owners and managers can manage staff', 'owner_manager_org'),
        ('kiosk_devices', 'owners and managers can manage kiosk devices', 'owner_manager_org'),
        ('store_staff_assignments', 'owners and managers can manage store staff assignments', 'owner_manager_org'),
        ('line_accounts', 'owners and managers can manage line accounts', 'owner_manager_org'),
        ('shift_submission_windows', 'owners and managers can manage shift submission windows', 'owner_manager_org'),
        ('shift_submissions', 'owners and managers can manage shift submissions', 'owner_manager_org'),
        ('shift_submission_items', 'owners and managers can manage shift submission items', 'owner_manager_org'),
        ('notifications', 'owners and managers can manage notifications', 'owner_manager_org'),
        ('attendance_records', 'owners and managers can manage attendance records', 'owner_manager_store'),
        ('attendance_events', 'owners and managers can manage attendance events', 'owner_manager_store'),
        ('attendance_requests', 'owners and managers can manage attendance requests', 'owner_manager_store'),
        ('shifts', 'owners and managers can manage shifts', 'owner_manager_store')
    ) as policies(table_name, policy_name, condition_kind)
  loop
    condition_sql := case policy_record.condition_kind
      when 'owner_org' then
        'private.current_user_role() = ''owner'' and organization_id = private.current_user_organization_id()'
      when 'owner_manager_org' then
        'private.current_user_role() in (''owner'', ''manager'') and organization_id = private.current_user_organization_id()'
      when 'owner_manager_store' then
        'private.current_user_role() in (''owner'', ''manager'') and private.can_access_store(store_id)'
    end;

    execute format(
      'drop policy if exists %I on public.%I',
      policy_record.policy_name,
      policy_record.table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      policy_record.policy_name || ' insert',
      policy_record.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      policy_record.policy_name || ' update',
      policy_record.table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      policy_record.policy_name || ' delete',
      policy_record.table_name
    );

    execute format(
      'create policy %I on public.%I for insert with check (%s)',
      policy_record.policy_name || ' insert',
      policy_record.table_name,
      condition_sql
    );
    execute format(
      'create policy %I on public.%I for update using (%s) with check (%s)',
      policy_record.policy_name || ' update',
      policy_record.table_name,
      condition_sql,
      condition_sql
    );
    execute format(
      'create policy %I on public.%I for delete using (%s)',
      policy_record.policy_name || ' delete',
      policy_record.table_name,
      condition_sql
    );
  end loop;
end;
$$;

-- These tables previously relied on their management FOR ALL policy for reads.
drop policy if exists "owners and managers can read kiosk devices"
  on public.kiosk_devices;
create policy "owners and managers can read kiosk devices"
on public.kiosk_devices for select
using (
  private.current_user_role() in ('owner', 'manager')
  and organization_id = private.current_user_organization_id()
);

drop policy if exists "owners can read manager store permissions"
  on public.manager_store_permissions;
create policy "owners can read manager store permissions"
on public.manager_store_permissions for select
using (
  private.current_user_role() = 'owner'
  and organization_id = private.current_user_organization_id()
);

drop policy if exists "owners can read sr organization permissions"
  on public.sr_organization_permissions;
create policy "owners can read sr organization permissions"
on public.sr_organization_permissions for select
using (
  private.current_user_role() = 'owner'
  and organization_id = private.current_user_organization_id()
);

-- Add the 13 leading-column indexes reported by the 2026-07-13 catalog check.
create index if not exists idx_attendance_events_organization_id
  on public.attendance_events (organization_id);
create index if not exists idx_attendance_records_organization_id
  on public.attendance_records (organization_id);
create index if not exists idx_attendance_requests_organization_id
  on public.attendance_requests (organization_id);
create index if not exists idx_attendance_requests_staff_id
  on public.attendance_requests (staff_id);
create index if not exists idx_manager_store_permissions_organization_id
  on public.manager_store_permissions (organization_id);
create index if not exists idx_notifications_organization_id
  on public.notifications (organization_id);
create index if not exists idx_shift_submission_items_organization_id
  on public.shift_submission_items (organization_id);
create index if not exists idx_shift_submission_items_submission_id
  on public.shift_submission_items (submission_id);
create index if not exists idx_shift_submission_windows_organization_id
  on public.shift_submission_windows (organization_id);
create index if not exists idx_shift_submissions_organization_id
  on public.shift_submissions (organization_id);
create index if not exists idx_shift_submissions_staff_id
  on public.shift_submissions (staff_id);
create index if not exists idx_shifts_organization_id
  on public.shifts (organization_id);
create index if not exists idx_store_staff_assignments_organization_id
  on public.store_staff_assignments (organization_id);

commit;
