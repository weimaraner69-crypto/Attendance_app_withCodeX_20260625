import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, storedHash: string | null) {
  if (!storedHash) return false;

  const [algorithm, salt, hash] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;

  const candidate = Buffer.from(scryptSync(pin, salt, 32).toString('hex'), 'utf8');
  const expected = Buffer.from(hash, 'utf8');

  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
