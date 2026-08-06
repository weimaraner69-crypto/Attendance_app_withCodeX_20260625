import { describe, expect, it } from 'vitest';

import {
  generateOwnerPasswordIntentToken,
  hashOwnerPasswordIntentToken,
} from './owner-password-intent';

describe('owner password intent token', () => {
  it('generates high-entropy tokens and stores only purpose-bound hashes', () => {
    const first = generateOwnerPasswordIntentToken();
    const second = generateOwnerPasswordIntentToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(hashOwnerPasswordIntentToken(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOwnerPasswordIntentToken(first)).toBe(hashOwnerPasswordIntentToken(first));
    expect(hashOwnerPasswordIntentToken(second)).not.toBe(hashOwnerPasswordIntentToken(first));
  });
});
