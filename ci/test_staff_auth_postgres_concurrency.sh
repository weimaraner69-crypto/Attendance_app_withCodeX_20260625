#!/usr/bin/env bash
set -euo pipefail

wait_for_test_ready() {
  local marker="$1"
  local acquired

  for _attempt in {1..100}; do
    acquired="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
      select pg_try_advisory_lock(
        hashtextextended('staff-auth-test-ready:' || '${marker}', 0)
      );
    ")"
    if [[ "${acquired}" == "f" ]]; then
      return
    fi
    sleep 0.02
  done

  echo "timed out waiting for staff Auth concurrency marker: ${marker}" >&2
  exit 1
}

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

owner_user_id="10000000-0000-0000-0000-000000000099"
owner_first_token="$(printf '1%.0s' {1..64})"
owner_second_token="$(printf '2%.0s' {1..64})"

psql --set ON_ERROR_STOP=1 --command "
  begin;
  select pg_advisory_xact_lock(
    hashtextextended('owner-password-recovery:${owner_user_id}', 0)
  );
  select public.issue_owner_password_recovery_intent(
    '${owner_user_id}', '${owner_first_token}', now() + interval '10 minutes'
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
owner_first_pid=$!

sleep 0.1

psql --set ON_ERROR_STOP=1 --command "
  select public.issue_owner_password_recovery_intent(
    '${owner_user_id}', '${owner_second_token}', now() + interval '10 minutes'
  );
" >/dev/null &
owner_second_pid=$!

wait "${owner_first_pid}"
wait "${owner_second_pid}"

owner_active_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*)
  from public.owner_password_recovery_intents
  where user_id = '${owner_user_id}'
    and consumed_at is null;
")"

if [[ "${owner_active_count}" != "1" ]]; then
  echo "expected exactly one active owner recovery intent, got ${owner_active_count}" >&2
  exit 1
fi

echo "concurrent owner password intent issuance passed"

owner_claim_token="$(printf '3%.0s' {1..64})"
psql --set ON_ERROR_STOP=1 --command "
  select public.issue_owner_password_recovery_intent(
    '${owner_user_id}', '${owner_claim_token}', now() + interval '10 minutes'
  );
  drop table if exists public.owner_recovery_claim_concurrency_results;
  create unlogged table public.owner_recovery_claim_concurrency_results (
    succeeded boolean not null
  );
" >/dev/null

psql --set ON_ERROR_STOP=1 --command "
  begin;
  insert into public.owner_recovery_claim_concurrency_results (succeeded)
  select exists(
    select 1 from public.claim_owner_password_recovery_intent(
      '${owner_claim_token}',
      '90000000-0000-0000-0000-000000000011'
    )
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
owner_claim_first_pid=$!

sleep 0.1

psql --set ON_ERROR_STOP=1 --command "
  insert into public.owner_recovery_claim_concurrency_results (succeeded)
  select exists(
    select 1 from public.claim_owner_password_recovery_intent(
      '${owner_claim_token}',
      '90000000-0000-0000-0000-000000000012'
    )
  );
" >/dev/null &
owner_claim_second_pid=$!

wait "${owner_claim_first_pid}"
wait "${owner_claim_second_pid}"

owner_claim_successes="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*) from public.owner_recovery_claim_concurrency_results where succeeded;
")"
owner_claim_rejections="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*) from public.owner_recovery_claim_concurrency_results where not succeeded;
")"

if [[ "${owner_claim_successes}" != "1" || "${owner_claim_rejections}" != "1" ]]; then
  echo "expected one successful and one rejected owner intent claim" >&2
  exit 1
fi

owner_winning_claim_id="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select claim_id
  from public.owner_password_recovery_intents
  where token_hash = '${owner_claim_token}';
")"
owner_claim_intent_id="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select id
  from public.owner_password_recovery_intents
  where token_hash = '${owner_claim_token}';
")"
psql --set ON_ERROR_STOP=1 --command "
  select public.finalize_owner_password_recovery_claim(
    '${owner_claim_intent_id}',
    '${owner_winning_claim_id}',
    'updated'
  );
" >/dev/null

psql --set ON_ERROR_STOP=1 --command "
  drop table public.owner_recovery_claim_concurrency_results;
" >/dev/null

echo "concurrent owner password intent claim passed"

owner_profile_guard_token="$(printf '8%.0s' {1..64})"
owner_profile_guard_claim_id="90000000-0000-0000-0000-000000000013"
psql --set ON_ERROR_STOP=1 --command "
  select public.issue_owner_password_recovery_intent(
    '${owner_user_id}', '${owner_profile_guard_token}', now() + interval '10 minutes'
  );
" >/dev/null

psql --set ON_ERROR_STOP=1 --command "
  begin;
  select * from public.claim_owner_password_recovery_intent(
    '${owner_profile_guard_token}',
    '${owner_profile_guard_claim_id}'
  );
  select pg_advisory_xact_lock(
    hashtextextended('staff-auth-test-ready:owner-profile-guard', 0)
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
owner_profile_guard_pid=$!

wait_for_test_ready "owner-profile-guard"

if psql --set ON_ERROR_STOP=1 --command "
  update public.user_profiles
  set role = 'manager'
  where id = '${owner_user_id}';
" >/dev/null 2>&1; then
  echo "owner profile change bypassed an in-flight password recovery claim" >&2
  exit 1
fi

wait "${owner_profile_guard_pid}"

owner_profile_guard_intent_id="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select id
  from public.owner_password_recovery_intents
  where token_hash = '${owner_profile_guard_token}';
")"
psql --set ON_ERROR_STOP=1 --command "
  select public.release_owner_password_recovery_claim(
    '${owner_profile_guard_intent_id}',
    '${owner_profile_guard_claim_id}'
  );
" >/dev/null

echo "concurrent owner profile mutation guard passed"

rate_limit_ip_hash="$(printf '4%.0s' {1..64})"
rate_limit_email_hash="$(printf '5%.0s' {1..64})"
psql --set ON_ERROR_STOP=1 --command "
  delete from public.owner_password_recovery_rate_limit_windows
  where (scope = 'ip' and subject_hash = '${rate_limit_ip_hash}')
     or (scope = 'email' and subject_hash = '${rate_limit_email_hash}');
  drop table if exists public.owner_recovery_rate_limit_concurrency_results;
  create unlogged table public.owner_recovery_rate_limit_concurrency_results (
    boundary text not null,
    allowed boolean not null
  );
" >/dev/null

rate_limit_pids=()
for _request in {1..6}; do
  psql --set ON_ERROR_STOP=1 --command "
    insert into public.owner_recovery_rate_limit_concurrency_results (boundary, allowed)
    select 'email', public.consume_owner_password_recovery_rate_limit(
      '${rate_limit_ip_hash}',
      '${rate_limit_email_hash}',
      '2026-08-06T12:00:00Z'
    );
  " >/dev/null &
  rate_limit_pids+=("$!")
done
for rate_limit_pid in "${rate_limit_pids[@]}"; do
  wait "${rate_limit_pid}"
done

email_allowed_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*) from public.owner_recovery_rate_limit_concurrency_results
  where boundary = 'email' and allowed;
")"
if [[ "${email_allowed_count}" != "5" ]]; then
  echo "expected exactly five concurrent requests for one email to be allowed" >&2
  exit 1
fi

ip_boundary_hash="$(printf '6%.0s' {1..64})"
rate_limit_pids=()
for request_index in {1..21}; do
  unique_email_hash="$(printf '%064d' "${request_index}")"
  psql --set ON_ERROR_STOP=1 --command "
    insert into public.owner_recovery_rate_limit_concurrency_results (boundary, allowed)
    select 'ip', public.consume_owner_password_recovery_rate_limit(
      '${ip_boundary_hash}',
      '${unique_email_hash}',
      '2026-08-06T12:00:00Z'
    );
  " >/dev/null &
  rate_limit_pids+=("$!")
done
for rate_limit_pid in "${rate_limit_pids[@]}"; do
  wait "${rate_limit_pid}"
done

ip_allowed_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*) from public.owner_recovery_rate_limit_concurrency_results
  where boundary = 'ip' and allowed;
")"
if [[ "${ip_allowed_count}" != "20" ]]; then
  echo "expected exactly twenty concurrent requests for one IP to be allowed" >&2
  exit 1
fi

ip_email_row_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*)
  from public.owner_password_recovery_rate_limit_windows
  where scope = 'email'
    and subject_hash in (
      select lpad(request_index::text, 64, '0')
      from generate_series(1, 21) request_index
    );
")"
if [[ "${ip_email_row_count}" != "20" ]]; then
  echo "expected blocked concurrent IP request not to create an email row" >&2
  exit 1
fi

psql --set ON_ERROR_STOP=1 --command "
  drop table public.owner_recovery_rate_limit_concurrency_results;
" >/dev/null

echo "concurrent owner password recovery rate limiting passed"

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
  select pg_advisory_xact_lock(
    hashtextextended('staff-auth-test-ready:update-first', 0)
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
update_pid=$!

wait_for_test_ready "update-first"

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

profile_first_auth_user_id="10000000-0000-0000-0000-000000000007"
profile_first_staff_id="20000000-0000-0000-0000-000000000007"
profile_first_email="profile-first@example.test"
profile_first_changed_email="profile-first-changed@example.test"

psql --set ON_ERROR_STOP=1 --command "
  insert into auth.users (id) values ('${profile_first_auth_user_id}');
  insert into public.staff (id, organization_id, name, email)
  values (
    '${profile_first_staff_id}',
    '${organization_id}',
    'Profile First',
    '${profile_first_email}'
  );
" >/dev/null

psql --set ON_ERROR_STOP=1 --command "
  begin;
  select public.create_staff_profile_with_email_guard(
    '${profile_first_auth_user_id}',
    '${profile_first_staff_id}',
    '${organization_id}',
    'Profile First',
    '${profile_first_email}'
  );
  select pg_advisory_xact_lock(
    hashtextextended('staff-auth-test-ready:profile-first', 0)
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
profile_pid=$!

wait_for_test_ready "profile-first"

if profile_first_error="$(psql --set ON_ERROR_STOP=1 --set VERBOSITY=verbose --command "
  update public.staff
  set email = '${profile_first_changed_email}'
  where id = '${profile_first_staff_id}';
" 2>&1)"; then
  echo "expected email update to fail after profile creation won the claim" >&2
  exit 1
fi

if [[ "${profile_first_error}" != *"23505:"* ]] \
  || [[ "${profile_first_error}" != *"linked staff email or organization cannot be changed"* ]]; then
  echo "profile-first loser failed with an unexpected error" >&2
  exit 1
fi

wait "${profile_pid}"

profile_first_state="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*) || ':' || min(target_staff.email)
  from public.user_profiles target_profile
  join public.staff target_staff on target_staff.id = '${profile_first_staff_id}'
  where target_profile.id = '${profile_first_auth_user_id}';
")"

if [[ "${profile_first_state}" != "1:${profile_first_email}" ]]; then
  echo "profile-first serialization left an unexpected state: ${profile_first_state}" >&2
  exit 1
fi

psql --set ON_ERROR_STOP=1 --command "
  delete from auth.users where id = '${profile_first_auth_user_id}';
" >/dev/null

echo "concurrent profile creation and staff email update passed"

first_staff_id="20000000-0000-0000-0000-000000000008"
second_staff_id="20000000-0000-0000-0000-000000000009"
shared_update_email="staff-update-race@example.test"

psql --set ON_ERROR_STOP=1 --command "
  insert into public.staff (id, organization_id, name, email) values
    ('${first_staff_id}', '${organization_id}', 'Update Race 1', 'update-race-1@example.test'),
    ('${second_staff_id}', '${organization_id}', 'Update Race 2', 'update-race-2@example.test');
" >/dev/null

psql --set ON_ERROR_STOP=1 --command "
  begin;
  update public.staff set email = '${shared_update_email}' where id = '${first_staff_id}';
  select pg_advisory_xact_lock(
    hashtextextended('staff-auth-test-ready:shared-update', 0)
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
first_update_pid=$!

wait_for_test_ready "shared-update"

if shared_update_error="$(psql --set ON_ERROR_STOP=1 --set VERBOSITY=verbose --command "
  update public.staff set email = '${shared_update_email}' where id = '${second_staff_id}';
" 2>&1)"; then
  echo "expected the second staff email update to fail" >&2
  exit 1
fi

if [[ "${shared_update_error}" != *"23505:"* ]] \
  || [[ "${shared_update_error}" != *"staff Auth email is already claimed"* ]]; then
  echo "second staff email update failed with an unexpected error" >&2
  exit 1
fi

wait "${first_update_pid}"

shared_update_state="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select
    target_staff.email || ':' || target_claim.staff_id
  from public.staff target_staff
  join private.staff_auth_email_claims target_claim
    on target_claim.normalized_email = '${shared_update_email}'
  where target_staff.id = '${second_staff_id}';
")"

if [[ "${shared_update_state}" != "update-race-2@example.test:${first_staff_id}" ]]; then
  echo "concurrent staff update left an unexpected loser or claim state" >&2
  exit 1
fi

echo "concurrent staff email updates passed"

first_insert_staff_id="20000000-0000-0000-0000-000000000010"
second_insert_staff_id="20000000-0000-0000-0000-000000000011"
shared_insert_email="staff-insert-race@example.test"

psql --set ON_ERROR_STOP=1 --command "
  begin;
  insert into public.staff (id, organization_id, name, email)
  values ('${first_insert_staff_id}', '${organization_id}', 'Insert Race 1', '${shared_insert_email}');
  select pg_advisory_xact_lock(
    hashtextextended('staff-auth-test-ready:shared-insert', 0)
  );
  select pg_sleep(1);
  commit;
" >/dev/null &
first_insert_pid=$!

wait_for_test_ready "shared-insert"

if shared_insert_error="$(psql --set ON_ERROR_STOP=1 --set VERBOSITY=verbose --command "
  insert into public.staff (id, organization_id, name, email)
  values ('${second_insert_staff_id}', '${organization_id}', 'Insert Race 2', '${shared_insert_email}');
" 2>&1)"; then
  echo "expected the second staff insert to fail" >&2
  exit 1
fi

if [[ "${shared_insert_error}" != *"23505:"* ]] \
  || [[ "${shared_insert_error}" != *"staff Auth email is already claimed"* ]]; then
  echo "second staff insert failed with an unexpected error" >&2
  exit 1
fi

wait "${first_insert_pid}"

shared_insert_state="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select
    count(*) filter (where target_staff.id = '${second_insert_staff_id}')
    || ':' || min(target_claim.staff_id::text)
  from private.staff_auth_email_claims target_claim
  left join public.staff target_staff
    on target_staff.id = '${second_insert_staff_id}'
  where target_claim.normalized_email = '${shared_insert_email}';
")"

if [[ "${shared_insert_state}" != "0:${first_insert_staff_id}" ]]; then
  echo "concurrent staff insert left an unexpected loser or claim state" >&2
  exit 1
fi

echo "concurrent staff email inserts passed"

null_same_staff_id="20000000-0000-0000-0000-000000000012"
null_same_email="null-same@example.test"

psql --set ON_ERROR_STOP=1 --command "
  insert into public.staff (id, organization_id, name, email)
  values ('${null_same_staff_id}', '${organization_id}', 'Null Same', '${null_same_email}');
  update public.staff set email = '${null_same_email}' where id = '${null_same_staff_id}';
  update public.staff set email = null where id = '${null_same_staff_id}';
" >/dev/null

null_email_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*) from public.staff
  where id = '${null_same_staff_id}' and email is null;
")"

if [[ "${null_email_count}" != "1" ]]; then
  echo "same-email and null transitions did not complete" >&2
  exit 1
fi

echo "same-email and null staff updates passed"
