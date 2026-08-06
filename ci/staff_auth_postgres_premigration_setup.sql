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
create table auth.users (id uuid primary key, email text);
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
\ir ../supabase/migrations/20260806114444_owner_password_recovery_intents.sql
