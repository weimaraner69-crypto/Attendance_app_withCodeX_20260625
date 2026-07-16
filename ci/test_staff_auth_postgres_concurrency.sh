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
