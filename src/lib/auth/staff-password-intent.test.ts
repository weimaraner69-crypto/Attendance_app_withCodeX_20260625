import { describe, expect, it } from 'vitest';

import {
  createStaffPasswordIntentToken,
  verifyStaffPasswordIntentToken,
} from './staff-password-intent';

const secret = 'test-secret';
const now = 1_800_000_000;

function createToken(overrides: Partial<Parameters<typeof createStaffPasswordIntentToken>[0]> = {}) {
  return createStaffPasswordIntentToken({
    sub: 'staff-auth-1',
    type: 'invite',
    exp: now + 600,
    nonce: '0123456789abcdef',
    ...overrides,
  }, secret);
}

describe('staff password intent token', () => {
  it('accepts a signed, unexpired intent for the same Auth user', () => {
    expect(verifyStaffPasswordIntentToken(createToken(), 'staff-auth-1', secret, now)).toMatchObject({
      sub: 'staff-auth-1',
      type: 'invite',
    });
  });

  it('rejects tampering, another user, and expired intents', () => {
    const token = createToken();
    expect(verifyStaffPasswordIntentToken(`${token}x`, 'staff-auth-1', secret, now)).toBeNull();
    expect(verifyStaffPasswordIntentToken(token, 'staff-auth-2', secret, now)).toBeNull();
    expect(verifyStaffPasswordIntentToken(createToken({ exp: now }), 'staff-auth-1', secret, now)).toBeNull();
  });

  it('keeps invite and recovery as the only accepted intent types', () => {
    expect(verifyStaffPasswordIntentToken(
      createToken({ type: 'recovery' }),
      'staff-auth-1',
      secret,
      now
    )?.type).toBe('recovery');
    expect(verifyStaffPasswordIntentToken(
      createToken({ type: 'signup' as 'invite' }),
      'staff-auth-1',
      secret,
      now
    )).toBeNull();
  });
});
