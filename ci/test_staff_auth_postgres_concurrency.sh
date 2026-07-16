#!/usr/bin/env bash
set -euo pipefail

user_id="10000000-0000-0000-0000-000000000001"
first_token="$(printf 'd%.0s' {1..64})"
second_token="$(printf 'e%.0s' {1..64})"

psql --set ON_ERROR_STOP=1 --command "
  begin;
  select pg_advisory_xact_lock(hashtextextended('${user_id}', 0));
  select public.issue_staff_password_intent(
    '${user_id}', '${first_token}', 'invite', now() + interval '10 minutes'
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
first_pid=$!

sleep 0.1

psql --set ON_ERROR_STOP=1 --command "
  select public.issue_staff_password_intent(
    '${user_id}', '${second_token}', 'recovery', now() + interval '10 minutes'
  );
" >/dev/null &
second_pid=$!

wait "${first_pid}"
wait "${second_pid}"

active_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*)
  from public.staff_password_intents
  where user_id = '${user_id}'
    and consumed_at is null;
")"

if [[ "${active_count}" != "1" ]]; then
  echo "expected exactly one active password intent, got ${active_count}" >&2
  exit 1
fi

echo "concurrent staff password intent issuance passed"

organization_id="00000000-0000-0000-0000-000000000001"
auth_user_id="10000000-0000-0000-0000-000000000006"
staff_id="20000000-0000-0000-0000-000000000006"
original_email="invite-race@example.test"
changed_email="invite-race-changed@example.test"

psql --set ON_ERROR_STOP=1 --command "
  insert into auth.users (id) values ('${auth_user_id}');
  insert into public.staff (id, organization_id, name, email)
  values ('${staff_id}', '${organization_id}', 'Invite Race', '${original_email}');
" >/dev/null

psql --set ON_ERROR_STOP=1 --command "
  begin;
  update public.staff
  set email = '${changed_email}'
  where id = '${staff_id}';
  select pg_sleep(1);
  commit;
" >/dev/null &
update_pid=$!

sleep 0.1

profile_created="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select public.create_staff_profile_with_email_guard(
    '${auth_user_id}',
    '${staff_id}',
    '${organization_id}',
    'Invite Race',
    '${original_email}'
  );
")"

wait "${update_pid}"

if [[ "${profile_created}" != "f" ]]; then
  echo "expected stale invitation profile creation to fail, got ${profile_created}" >&2
  exit 1
fi

profile_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*) from public.user_profiles where id = '${auth_user_id}';
")"

if [[ "${profile_count}" != "0" ]]; then
  echo "stale invitation left a profile behind" >&2
  exit 1
fi

echo "concurrent staff email update and profile creation passed"
