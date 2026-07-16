\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

\ir ../supabase/migrations/202606250001_initial_attendance_schema.sql
\ir ../supabase/migrations/202606250002_external_api_keys.sql
\ir ../supabase/migrations/202606260003_notifications.sql
\ir ../supabase/migrations/202606290004_line_integration.sql
\ir ../supabase/migrations/202607020001_privileged_login_pin.sql
\ir ../supabase/migrations/202607090001_supabase_advisor_warnings.sql
\ir ../supabase/migrations/202607090002_security_advisor_function_execute.sql
\ir ../supabase/migrations/202607130001_supabase_advisor_review_followup.sql
\ir ../supabase/migrations/202607130002_performance_advisor_optimization.sql
\ir ../supabase/migrations/20260716034432_secure_staff_password_intents.sql
\ir ../supabase/migrations/20260716055206_external_api_rate_limit_access_logs.sql
\ir ../supabase/migrations/20260716145718_staff_auth_email_serialization.sql

grant select on
  public.staff,
  public.attendance_records,
  public.attendance_events,
  public.attendance_requests,
  public.shifts,
  public.shift_submissions,
  public.shift_submission_items,
  public.notifications
to authenticated;

insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Organization 1'),
  ('00000000-0000-0000-0000-000000000002', 'Organization 2'),
  ('00000000-0000-0000-0000-000000000003', 'Organization 3');

insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004');

insert into public.user_profiles (
  id, organization_id, role, display_name, email
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'staff', 'Staff 1', 'staff1@example.test'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'staff', 'Staff 2', 'staff2@example.test'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'staff', 'Delete User', 'delete-user@example.test'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000003',
    'staff', 'Delete Org', 'delete-org@example.test'
  );

insert into public.staff (id, organization_id, auth_user_id, name) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Staff 1'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Staff 2'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Delete User'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    'Delete Org'
  );

insert into public.stores (id, organization_id, name) values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Store 1'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Store 2'
  );

insert into public.attendance_records (
  id, organization_id, store_id, staff_id, work_date
) values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '2026-07-16'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '2026-07-16'
  );

insert into public.attendance_events (
  id, organization_id, attendance_record_id, store_id, staff_id,
  event_type, occurred_at, source
) values
  (
    '41000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'clock_in', now(), 'system'
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'clock_in', now(), 'system'
  );

insert into public.attendance_requests (
  id, organization_id, store_id, staff_id, attendance_record_id,
  request_type, target_date, reason
) values
  (
    '42000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'attendance_correction', '2026-07-16', 'test'
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    'attendance_correction', '2026-07-16', 'test'
  );

insert into public.shifts (
  id, organization_id, store_id, staff_id, work_date, start_at, end_at
) values
  (
    '43000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '2026-07-17', now(), now() + interval '8 hours'
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '2026-07-17', now(), now() + interval '8 hours'
  );

insert into public.shift_submission_windows (
  id, organization_id, store_id, title, period_start, period_end, due_at
) values
  (
    '44000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Window 1', '2026-07-20', '2026-07-26', now() + interval '1 day'
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'Window 2', '2026-07-20', '2026-07-26', now() + interval '1 day'
  );

insert into public.shift_submissions (
  id, organization_id, window_id, staff_id
) values
  (
    '45000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '44000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001'
  ),
  (
    '45000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '44000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002'
  );

insert into public.shift_submission_items (
  id, organization_id, submission_id, preferred_date,
  start_time, end_time
) values
  (
    '46000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000001',
    '2026-07-20', '09:00', '17:00'
  ),
  (
    '46000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '45000000-0000-0000-0000-000000000002',
    '2026-07-20', '09:00', '17:00'
  );

insert into public.notifications (
  id, organization_id, recipient_staff_id, title, body, notification_type
) values
  (
    '47000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Notification 1', 'body', 'test'
  ),
  (
    '47000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Notification 2', 'body', 'test'
  );

do $$
begin
  begin
    update public.staff
    set organization_id = '00000000-0000-0000-0000-000000000002'
    where id = '20000000-0000-0000-0000-000000000001';
    set constraints staff_auth_user_organization_fk immediate;
    raise exception 'cross-organization staff link was accepted';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

delete from auth.users
where id = '10000000-0000-0000-0000-000000000003';

do $$
begin
  if exists (
    select 1 from public.user_profiles
    where id = '10000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'Auth deletion did not cascade to the profile';
  end if;
  if exists (
    select 1 from public.staff
    where id = '20000000-0000-0000-0000-000000000003'
      and auth_user_id is not null
  ) then
    raise exception 'Auth deletion did not clear the staff link';
  end if;
end;
$$;

insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000005');
insert into public.staff (
  id, organization_id, name, email
) values (
  '20000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'Compensation Test',
  'compensation@example.test'
);

do $$
begin
  if not public.create_staff_profile_with_email_guard(
    '10000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Compensation Test',
    'compensation@example.test'
  ) then
    raise exception 'serialized profile creation failed';
  end if;
end;
$$;

delete from auth.users
where id = '10000000-0000-0000-0000-000000000005';

do $$
begin
  if exists (
    select 1 from public.user_profiles
    where id = '10000000-0000-0000-0000-000000000005'
  ) then
    raise exception 'compensation deletion did not remove the staff profile';
  end if;
  if not exists (
    select 1 from public.staff
    where id = '20000000-0000-0000-0000-000000000005'
      and auth_user_id is null
  ) then
    raise exception 'compensation deletion changed the unlinked staff row';
  end if;
end;
$$;

select public.issue_staff_password_intent(
  '10000000-0000-0000-0000-000000000004',
  repeat('a', 64),
  'invite',
  now() + interval '10 minutes'
);
delete from public.organizations
where id = '00000000-0000-0000-0000-000000000003';

do $$
begin
  if exists (
    select 1 from public.user_profiles
    where id = '10000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'Organization deletion did not remove the profile';
  end if;
  if exists (
    select 1 from public.staff
    where id = '20000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'Organization deletion did not remove the staff row';
  end if;
end;
$$;

select public.issue_staff_password_intent(
  '10000000-0000-0000-0000-000000000001',
  repeat('b', 64),
  'invite',
  now() + interval '10 minutes'
);
select public.issue_staff_password_intent(
  '10000000-0000-0000-0000-000000000001',
  repeat('c', 64),
  'recovery',
  now() + interval '10 minutes'
);

do $$
declare
  claimed_count integer;
begin
  if (
    select count(*) from public.staff_password_intents
    where user_id = '10000000-0000-0000-0000-000000000001'
      and consumed_at is null
  ) <> 1 then
    raise exception 'more than one active intent exists for a user';
  end if;

  with claimed as (
    update public.staff_password_intents
    set consumed_at = now()
    where token_hash = repeat('c', 64)
      and consumed_at is null
      and expires_at > now()
    returning id
  )
  select count(*) into claimed_count from claimed;
  if claimed_count <> 1 then
    raise exception 'first atomic claim did not succeed exactly once';
  end if;

  with claimed as (
    update public.staff_password_intents
    set consumed_at = now()
    where token_hash = repeat('c', 64)
      and consumed_at is null
      and expires_at > now()
    returning id
  )
  select count(*) into claimed_count from claimed;
  if claimed_count <> 0 then
    raise exception 'second atomic claim reused an intent';
  end if;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.staff_password_intents', 'select')
     or has_table_privilege('authenticated', 'public.staff_password_intents', 'select')
     or has_function_privilege(
       'authenticated',
       'public.issue_staff_password_intent(uuid,text,text,timestamptz)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.issue_staff_password_intent(uuid,text,text,timestamptz)',
       'execute'
     ) then
    raise exception 'password intent privileges are not fail-closed';
  end if;
end;
$$;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
do $$
begin
  if exists (
    select 1 from public.staff
    where organization_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'staff RLS exposed the other organization';
  end if;
  if (select count(*) from public.attendance_records) <> 1 then
    raise exception 'attendance_records RLS did not isolate the linked staff row';
  end if;
  if (select count(*) from public.attendance_events) <> 1 then
    raise exception 'attendance_events RLS did not isolate the linked staff row';
  end if;
  if (select count(*) from public.attendance_requests) <> 1 then
    raise exception 'attendance_requests RLS did not isolate the linked staff row';
  end if;
  if (select count(*) from public.shifts) <> 1 then
    raise exception 'shifts RLS did not isolate the linked staff row';
  end if;
  if (select count(*) from public.shift_submissions) <> 1 then
    raise exception 'shift_submissions RLS did not isolate the linked staff row';
  end if;
  if (select count(*) from public.shift_submission_items) <> 1 then
    raise exception 'shift_submission_items RLS did not isolate the linked staff row';
  end if;
  if (select count(*) from public.notifications) <> 1 then
    raise exception 'notifications RLS did not isolate the linked staff row';
  end if;
end;
$$;
rollback;

\echo 'staff auth PostgreSQL integration checks passed'
