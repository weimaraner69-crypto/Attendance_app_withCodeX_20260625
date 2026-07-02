import { spawnSync } from 'child_process';

const service = 'attendance-app.external-api';
const account = 'daily-report-production';
const baseUrl = process.env.EXTERNAL_API_BASE_URL ?? 'http://127.0.0.1:3000';

const keyResult = spawnSync(
  'security',
  ['find-generic-password', '-s', service, '-a', account, '-w'],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  },
);

if (keyResult.status !== 0) {
  console.error('External API key was not found in macOS Keychain.');
  process.exit(keyResult.status ?? 1);
}

const apiKey = keyResult.stdout.trim();

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'X-External-Api-Key': apiKey,
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);
  return { response, body };
}

const health = await request('/api/external/v1/health');
console.log(`health: status=${health.response.status} ok=${health.body?.ok === true}`);

const stores = await request('/api/external/v1/stores');
const storeCount = Number.isInteger(stores.body?.count) ? stores.body.count : 'invalid';
console.log(`stores: status=${stores.response.status} count=${storeCount}`);

const staff = await request('/api/external/v1/staff');
const staffCount = Number.isInteger(staff.body?.count) ? staff.body.count : 'invalid';
console.log(`staff: status=${staff.response.status} count=${staffCount}`);

const failures = [
  health.response.status !== 200 || health.body?.ok !== true,
  stores.response.status !== 200 || !Number.isInteger(stores.body?.count),
  staff.response.status !== 200 || !Number.isInteger(staff.body?.count),
];

if (failures.some(Boolean)) {
  process.exit(1);
}

if (stores.body.count === 0) {
  console.log('attendance: skipped (no stores are registered)');
  process.exit(0);
}

console.log('attendance: ready for a store-specific verification');
