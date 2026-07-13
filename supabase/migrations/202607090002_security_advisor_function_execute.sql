-- Keep SECURITY DEFINER helpers available to RLS without exposing them as RPCs.
-- RLS policy expressions run with the querying user's privileges, so authenticated
-- users still need EXECUTE. Moving the functions out of the exposed public schema
-- prevents direct PostgREST RPC access while preserving policy evaluation.

begin;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

do $$
begin
  if to_regprocedure('public.current_user_organization_id()') is not null then
    alter function public.current_user_organization_id() set schema private;
  end if;

  if to_regprocedure('public.current_user_role()') is not null then
    alter function public.current_user_role() set schema private;
  end if;

  if to_regprocedure('public.can_access_store(uuid)') is not null then
    alter function public.can_access_store(uuid) set schema private;
  end if;

  if to_regprocedure('private.current_user_organization_id()') is not null then
    execute 'alter function private.current_user_organization_id() set search_path = ''''';
    execute 'revoke execute on function private.current_user_organization_id() from public, anon';
    execute 'grant execute on function private.current_user_organization_id() to authenticated';
  end if;

  if to_regprocedure('private.current_user_role()') is not null then
    execute 'alter function private.current_user_role() set search_path = ''''';
    execute 'revoke execute on function private.current_user_role() from public, anon';
    execute 'grant execute on function private.current_user_role() to authenticated';
  end if;

  if to_regprocedure('private.can_access_store(uuid)') is not null then
    execute 'alter function private.can_access_store(uuid) set search_path = ''''';
    execute 'revoke execute on function private.can_access_store(uuid) from public, anon';
    execute 'grant execute on function private.can_access_store(uuid) to authenticated';
  end if;
end;
$$;

commit;
