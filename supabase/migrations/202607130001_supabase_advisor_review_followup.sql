-- Reconcile databases that applied the pre-review Advisor migration.

begin;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    alter function public.set_updated_at() set search_path = pg_catalog;
  end if;
end;
$$;

-- The initial schema already provides idx_line_accounts_staff for this key.
drop index if exists public.idx_line_accounts_staff_id;

commit;
