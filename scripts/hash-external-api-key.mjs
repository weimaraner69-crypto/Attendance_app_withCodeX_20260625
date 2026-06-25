import { createHash, randomBytes } from 'crypto';

const rawKey = process.argv[2] ?? `att_${randomBytes(32).toString('base64url')}`;
const keyHash = createHash('sha256').update(rawKey, 'utf8').digest('hex');

console.log(`API key: ${rawKey}`);
console.log(`SHA-256 hash: ${keyHash}`);
console.log('');
console.log('Insert key_hash into public.external_api_keys. Store the API key securely; it is shown only now.');
