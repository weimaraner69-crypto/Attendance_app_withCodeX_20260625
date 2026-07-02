import { createHash, randomBytes } from 'crypto';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const storeInKeychain = args.includes('--store-keychain');
const rawKeyArgument = args.find((argument) => !argument.startsWith('--'));

if (storeInKeychain && rawKeyArgument) {
  console.error('Do not pass a plaintext API key with --store-keychain.');
  process.exit(1);
}

const rawKey = rawKeyArgument ?? `att_${randomBytes(32).toString('base64url')}`;
const keyHash = createHash('sha256').update(rawKey, 'utf8').digest('hex');

if (storeInKeychain) {
  const service = 'attendance-app.external-api';
  const account = 'daily-report-production';
  const result = spawnSync(
    'security',
    [
      'add-generic-password',
      '-U',
      '-s',
      service,
      '-a',
      account,
      '-l',
      'Attendance app external API key',
      '-w',
    ],
    {
      input: `${rawKey}\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'ignore', 'pipe'],
    },
  );

  if (result.status !== 0) {
    console.error('Failed to store the API key in macOS Keychain.');
    process.exit(result.status ?? 1);
  }

  console.log(`Keychain service: ${service}`);
  console.log(`Keychain account: ${account}`);
  console.log(`SHA-256 hash: ${keyHash}`);
  console.log('The plaintext API key was not printed.');
  process.exit(0);
}

console.log(`API key: ${rawKey}`);
console.log(`SHA-256 hash: ${keyHash}`);
console.log('');
console.log('Insert key_hash into public.external_api_keys. Store the API key securely; it is shown only now.');
