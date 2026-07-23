\set ON_ERROR_STOP on

\ir staff_auth_postgres_premigration_setup.sql

insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-000000000091', 'Atomicity Organization 1'),
  ('00000000-0000-0000-0000-000000000092', 'Atomicity Organization 2');

insert into public.staff (id, organization_id, name, email) values
  (
    '20000000-0000-0000-0000-000000000091',
    '00000000-0000-0000-0000-000000000091',
    'Atomicity Duplicate 1',
    'atomicity-duplicate@example.test'
  ),
  (
    '20000000-0000-0000-0000-000000000092',
    '00000000-0000-0000-0000-000000000092',
    'Atomicity Duplicate 2',
    ' Atomicity-Duplicate@Example.Test '
  );

\set ON_ERROR_STOP off
\ir ../supabase/migrations/20260716145718_staff_auth_email_serialization.sql
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('private.staff_auth_email_claims') is not null
    or to_regprocedure('private.normalize_staff_auth_email(text)') is not null
    or to_regprocedure(
      'public.create_staff_profile_with_email_guard(uuid,uuid,uuid,text,text)'
    ) is not null then
    raise exception 'failed staff Auth migration left partial objects behind';
  end if;
end;
$$;

\echo 'staff Auth migration rollback checks passed'
