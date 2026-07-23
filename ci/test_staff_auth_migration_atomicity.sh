#!/usr/bin/env bash
set -euo pipefail

atomicity_db="attendance_staff_auth_atomicity_test"
locking_db="attendance_staff_auth_locking_test"

cleanup() {
  dropdb --if-exists "${atomicity_db}" >/dev/null
  dropdb --if-exists "${locking_db}" >/dev/null
}
trap cleanup EXIT

cleanup
createdb "${atomicity_db}"
psql --dbname "${atomicity_db}" --set ON_ERROR_STOP=1 \
  --file ci/test_staff_auth_migration_atomicity.sql >/dev/null

createdb "${locking_db}"
psql --dbname "${locking_db}" --set ON_ERROR_STOP=1 \
  --file ci/staff_auth_postgres_premigration_setup.sql >/dev/null
psql --dbname "${locking_db}" --set ON_ERROR_STOP=1 --command "
  insert into public.organizations (id, name)
  values ('00000000-0000-0000-0000-000000000093', 'Locking Organization');
" >/dev/null

psql --dbname "${locking_db}" --set ON_ERROR_STOP=1 --command "
  begin;
  insert into public.staff (id, organization_id, name, email)
  values (
    '20000000-0000-0000-0000-000000000093',
    '00000000-0000-0000-0000-000000000093',
    'Concurrent Before Migration',
    'concurrent-before-migration@example.test'
  );
  select pg_advisory_xact_lock(hashtextextended('staff-auth-migration-writer', 0));
  select pg_sleep(1);
  commit;
" >/dev/null &
writer_pid=$!

writer_ready=false
for _attempt in {1..100}; do
  marker_acquired="$(psql --dbname "${locking_db}" --tuples-only --no-align \
    --set ON_ERROR_STOP=1 --command "
      select pg_try_advisory_lock(
        hashtextextended('staff-auth-migration-writer', 0)
      );
    ")"
  if [[ "${marker_acquired}" == "f" ]]; then
    writer_ready=true
    break
  fi
  sleep 0.02
done

if [[ "${writer_ready}" != "true" ]]; then
  echo "timed out waiting for the migration writer" >&2
  exit 1
fi

psql --dbname "${locking_db}" --set ON_ERROR_STOP=1 \
  --file supabase/migrations/20260716145718_staff_auth_email_serialization.sql \
  >/dev/null &
migration_pid=$!

sleep 0.1
if ! kill -0 "${migration_pid}" 2>/dev/null; then
  echo "staff Auth migration did not wait for a concurrent writer" >&2
  exit 1
fi

wait "${writer_pid}"
wait "${migration_pid}"

claim_count="$(psql --dbname "${locking_db}" --tuples-only --no-align \
  --set ON_ERROR_STOP=1 --command "
    select count(*)
    from private.staff_auth_email_claims
    where staff_id = '20000000-0000-0000-0000-000000000093';
  ")"

if [[ "${claim_count}" != "1" ]]; then
  echo "migration lock did not include the concurrent staff write" >&2
  exit 1
fi

echo "staff Auth migration atomicity and locking checks passed"
