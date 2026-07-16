import { describe, expect, it } from 'vitest';

import {
  generateStaffPasswordIntentToken,
  hashStaffPasswordIntentToken,
} from './staff-password-intent';

describe('staff password intent token', () => {
  it('generates high-entropy opaque tokens and stores only stable hashes', () => {
    const first = generateStaffPasswordIntentToken();
    const second = generateStaffPasswordIntentToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(hashStaffPasswordIntentToken(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashStaffPasswordIntentToken(first)).toBe(hashStaffPasswordIntentToken(first));
    expect(hashStaffPasswordIntentToken(second)).not.toBe(hashStaffPasswordIntentToken(first));
  });
});
