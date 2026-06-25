-- Initial production schema for the attendance app.
-- Target: Supabase PostgreSQL.

create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'manager', 'sr', 'staff');
create type public.attendance_status as enum ('not_started', 'working', 'on_break', 'finished');
create type public.attendance_event_type as enum ('clock_in', 'break_start', 'break_end', 'clock_out');
create type public.attendance_source as enum ('kiosk', 'mobile_web', 'line', 'admin_manual', 'system');
create type public.request_type as enum ('attendance_correction', 'leave', 'overtime');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.shift_status as enum ('draft', 'published', 'confirmed', 'completed', 'cancelled');
create type public.shift_submission_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type public.line_link_status as enum ('pending', 'linked', 'blocked', 'revoked');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'temporary', 'other');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  address text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  gps_radius_meters integer not null default 300 check (gps_radius_meters > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, code)
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  default_store_id uuid references public.stores(id) on delete set null,
  employee_code text,
  name text not null,
  name_kana text,
  employment_type public.employment_type,
  hourly_wage integer check (hourly_wage is null or hourly_wage >= 0),
  phone text,
  email text,
  pin_hash text,
  pin_updated_at timestamptz,
  pin_failed_attempts integer not null default 0 check (pin_failed_attempts >= 0),
  pin_locked_until timestamptz,
  is_active boolean not null default true,
  joined_on date,
  retired_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id),
  unique (organization_id, employee_code)
);

create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  device_code text not null,
  name text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, device_code)
);

create table public.store_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (store_id, staff_id, starts_on),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.manager_store_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, store_id)
);

create table public.sr_organization_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  can_export boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.line_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  line_user_id text not null,
  display_name text,
  picture_url text,
  status public.line_link_status not null default 'pending',
  linked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (line_user_id),
  unique (organization_id, staff_id)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  work_date date not null,
  status public.attendance_status not null default 'not_started',
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  total_work_minutes integer not null default 0 check (total_work_minutes >= 0),
  night_shift_minutes integer not null default 0 check (night_shift_minutes >= 0),
  is_manual boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, work_date)
);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendance_record_id uuid references public.attendance_records(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  event_type public.attendance_event_type not null,
  occurred_at timestamptz not null,
  source public.attendance_source not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  kiosk_device_id uuid references public.kiosk_devices(id) on delete set null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  gps_accuracy_meters numeric(10, 2),
  distance_from_store_meters numeric(10, 2),
  gps_verified boolean,
  pin_verified_at timestamptz,
  line_account_id uuid references public.line_accounts(id) on delete set null,
  line_message_id text,
  created_by_user_id uuid references public.user_profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (line_message_id),
  check (
    (source = 'kiosk' and kiosk_device_id is not null and pin_verified_at is not null)
    or source <> 'kiosk'
  ),
  check (
    (source = 'mobile_web' and auth_user_id is not null)
    or source <> 'mobile_web'
  ),
  check (
    (source = 'line' and line_account_id is not null)
    or source <> 'line'
  )
);

create table public.attendance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  attendance_record_id uuid references public.attendance_records(id) on delete set null,
  request_type public.request_type not null,
  target_date date not null,
  requested_clock_in_at timestamptz,
  requested_clock_out_at timestamptz,
  reason text not null,
  status public.request_status not null default 'pending',
  reviewed_by_user_id uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  work_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  break_minutes integer not null default 60 check (break_minutes >= 0),
  status public.shift_status not null default 'draft',
  created_by_user_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table public.shift_submission_windows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null,
  due_at timestamptz not null,
  is_open boolean not null default true,
  created_by_user_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.shift_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  window_id uuid not null references public.shift_submission_windows(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  status public.shift_submission_status not null default 'draft',
  submitted_at timestamptz,
  source public.attendance_source not null default 'mobile_web',
  line_account_id uuid references public.line_accounts(id) on delete set null,
  reviewed_by_user_id uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (window_id, staff_id)
);

create table public.shift_submission_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submission_id uuid not null references public.shift_submissions(id) on delete cascade,
  preferred_date date not null,
  start_time time,
  end_time time,
  is_unavailable boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    is_unavailable
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  actor_line_account_id uuid references public.line_accounts(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger set_user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();
create trigger set_stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();
create trigger set_staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();
create trigger set_kiosk_devices_updated_at before update on public.kiosk_devices
  for each row execute function public.set_updated_at();
create trigger set_line_accounts_updated_at before update on public.line_accounts
  for each row execute function public.set_updated_at();
create trigger set_attendance_records_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();
create trigger set_attendance_requests_updated_at before update on public.attendance_requests
  for each row execute function public.set_updated_at();
create trigger set_shifts_updated_at before update on public.shifts
  for each row execute function public.set_updated_at();
create trigger set_shift_submission_windows_updated_at before update on public.shift_submission_windows
  for each row execute function public.set_updated_at();
create trigger set_shift_submissions_updated_at before update on public.shift_submissions
  for each row execute function public.set_updated_at();
create trigger set_shift_submission_items_updated_at before update on public.shift_submission_items
  for each row execute function public.set_updated_at();

create index idx_user_profiles_org_role on public.user_profiles (organization_id, role);
create index idx_stores_org_active on public.stores (organization_id, is_active);
create index idx_staff_org_active on public.staff (organization_id, is_active);
create index idx_staff_auth_user on public.staff (auth_user_id);
create index idx_kiosk_devices_store_active on public.kiosk_devices (store_id, is_active);
create index idx_store_staff_store on public.store_staff_assignments (store_id, staff_id);
create index idx_line_accounts_staff on public.line_accounts (staff_id);
create index idx_attendance_records_store_date on public.attendance_records (store_id, work_date);
create index idx_attendance_records_staff_date on public.attendance_records (staff_id, work_date desc);
create index idx_attendance_events_staff_time on public.attendance_events (staff_id, occurred_at desc);
create index idx_attendance_events_record on public.attendance_events (attendance_record_id);
create index idx_attendance_requests_store_status on public.attendance_requests (store_id, status, target_date desc);
create index idx_shifts_store_date on public.shifts (store_id, work_date);
create index idx_shifts_staff_date on public.shifts (staff_id, work_date);
create index idx_shift_submissions_window_status on public.shift_submissions (window_id, status);
create index idx_audit_logs_org_created_at on public.audit_logs (organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.stores enable row level security;
alter table public.staff enable row level security;
alter table public.kiosk_devices enable row level security;
alter table public.store_staff_assignments enable row level security;
alter table public.manager_store_permissions enable row level security;
alter table public.sr_organization_permissions enable row level security;
alter table public.line_accounts enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_requests enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_submission_windows enable row level security;
alter table public.shift_submissions enable row level security;
alter table public.shift_submission_items enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.user_profiles
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_profiles
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
      and (
        profile.role = 'owner'
        or (
          profile.role = 'manager'
          and exists (
            select 1
            from public.manager_store_permissions permission
            where permission.user_id = profile.id
              and permission.store_id = target_store_id
          )
        )
        or (
          profile.role = 'sr'
          and exists (
            select 1
            from public.stores store
            join public.sr_organization_permissions permission
              on permission.organization_id = store.organization_id
            where store.id = target_store_id
              and permission.user_id = profile.id
          )
        )
      )
  )
$$;

create policy "organization members can read own organization"
on public.organizations for select
using (id = public.current_user_organization_id());

create policy "owners can update own organization"
on public.organizations for update
using (
  public.current_user_role() = 'owner'
  and id = public.current_user_organization_id()
)
with check (
  public.current_user_role() = 'owner'
  and id = public.current_user_organization_id()
);

create policy "profiles can read own organization profiles"
on public.user_profiles for select
using (organization_id = public.current_user_organization_id());

create policy "owners can manage profiles"
on public.user_profiles for all
using (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
);

create policy "organization members can read stores"
on public.stores for select
using (organization_id = public.current_user_organization_id());

create policy "owners can manage stores"
on public.stores for all
using (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
);

create policy "organization members can read staff"
on public.staff for select
using (organization_id = public.current_user_organization_id());

create policy "owners and managers can manage staff"
on public.staff for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);

create policy "staff can read own staff profile"
on public.staff for select
using (auth_user_id = auth.uid());

create policy "owners and managers can manage kiosk devices"
on public.kiosk_devices for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);

create policy "organization members can read store staff assignments"
on public.store_staff_assignments for select
using (organization_id = public.current_user_organization_id());

create policy "owners and managers can manage store staff assignments"
on public.store_staff_assignments for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);

create policy "owners can manage manager store permissions"
on public.manager_store_permissions for all
using (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
);

create policy "owners can manage sr organization permissions"
on public.sr_organization_permissions for all
using (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() = 'owner'
  and organization_id = public.current_user_organization_id()
);

create policy "organization members can read line accounts"
on public.line_accounts for select
using (organization_id = public.current_user_organization_id());

create policy "owners and managers can manage line accounts"
on public.line_accounts for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);

create policy "store scoped users can read attendance records"
on public.attendance_records for select
using (
  public.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = attendance_records.staff_id
      and own_staff.auth_user_id = auth.uid()
  )
);

create policy "owners and managers can manage attendance records"
on public.attendance_records for all
using (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
);

create policy "store scoped users can read attendance events"
on public.attendance_events for select
using (
  public.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = attendance_events.staff_id
      and own_staff.auth_user_id = auth.uid()
  )
);

create policy "owners and managers can manage attendance events"
on public.attendance_events for all
using (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
);

create policy "store scoped users can read attendance requests"
on public.attendance_requests for select
using (
  public.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = attendance_requests.staff_id
      and own_staff.auth_user_id = auth.uid()
  )
);

create policy "owners and managers can manage attendance requests"
on public.attendance_requests for all
using (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
);

create policy "store scoped users can read shifts"
on public.shifts for select
using (
  public.can_access_store(store_id)
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = shifts.staff_id
      and own_staff.auth_user_id = auth.uid()
  )
);

create policy "owners and managers can manage shifts"
on public.shifts for all
using (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and public.can_access_store(store_id)
);

create policy "organization members can read shift submission windows"
on public.shift_submission_windows for select
using (organization_id = public.current_user_organization_id());

create policy "owners and managers can manage shift submission windows"
on public.shift_submission_windows for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);

create policy "organization members can read shift submissions"
on public.shift_submissions for select
using (
  organization_id = public.current_user_organization_id()
  or exists (
    select 1
    from public.staff own_staff
    where own_staff.id = shift_submissions.staff_id
      and own_staff.auth_user_id = auth.uid()
  )
);

create policy "owners and managers can manage shift submissions"
on public.shift_submissions for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);

create policy "organization members can read shift submission items"
on public.shift_submission_items for select
using (
  organization_id = public.current_user_organization_id()
  or exists (
    select 1
    from public.shift_submissions submission
    join public.staff own_staff on own_staff.id = submission.staff_id
    where submission.id = shift_submission_items.submission_id
      and own_staff.auth_user_id = auth.uid()
  )
);

create policy "owners and managers can manage shift submission items"
on public.shift_submission_items for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);

create policy "organization members can read audit logs"
on public.audit_logs for select
using (organization_id = public.current_user_organization_id());
