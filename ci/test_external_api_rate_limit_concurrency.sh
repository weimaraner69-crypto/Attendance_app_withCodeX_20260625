#!/usr/bin/env bash
set -euo pipefail

key_id="50000000-0000-0000-0000-000000000001"
window_time="2026-07-16T06:10:00Z"
request_count=61
pids=()

psql --set ON_ERROR_STOP=1 --command "
  delete from public.external_api_rate_limit_windows
  where key_id = '${key_id}';
  drop table if exists public.external_api_rate_limit_concurrency_results;
  create unlogged table public.external_api_rate_limit_concurrency_results (
    allowed boolean not null
  );
" >/dev/null

for _ in $(seq 1 "${request_count}"); do
  psql --set ON_ERROR_STOP=1 --command "
    insert into public.external_api_rate_limit_concurrency_results (allowed)
    select allowed
      from public.consume_external_api_rate_limit(
        '${key_id}',
        '${window_time}'
      );
  " >/dev/null &
  pids+=("$!")
done

for pid in "${pids[@]}"; do
  wait "${pid}"
done

actual_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select request_count
  from public.external_api_rate_limit_windows
  where key_id = '${key_id}'
    and window_started_at = '${window_time}';
")"

allowed_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*)
  from public.external_api_rate_limit_concurrency_results
  where allowed;
")"

denied_count="$(psql --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  select count(*)
  from public.external_api_rate_limit_concurrency_results
  where not allowed;
")"

if [[ "${actual_count}" != "${request_count}" ]]; then
  echo "expected ${request_count} concurrent requests, got ${actual_count}" >&2
  exit 1
fi

if [[ "${allowed_count}" != "60" || "${denied_count}" != "1" ]]; then
  echo "expected 60 allowed and 1 denied, got ${allowed_count} allowed and ${denied_count} denied" >&2
  exit 1
fi

psql --set ON_ERROR_STOP=1 --command "
  drop table public.external_api_rate_limit_concurrency_results;
" >/dev/null

echo "concurrent external API 60/61 rate limiting passed"
