import { describe, expect, it, vi } from 'vitest';

import {
  OWNER_RECOVERY_BODY_LIMIT_BYTES,
  buildOwnerPasswordRecoveryRateLimitKeys,
  consumeOwnerPasswordRecoveryRateLimit,
  enforceOwnerPasswordRecoveryResponseFloor,
  readOwnerPasswordRecoveryEmail,
} from './owner-password-recovery-guard';

const appOrigin = ['https:', '', 'attendance.example'].join('/');

describe('owner password recovery public request guard', () => {
  it('creates stable domain-separated hashes without retaining raw PII', () => {
    const secret = 'test-only-secret';
    const first = buildOwnerPasswordRecoveryRateLimitKeys({
      email: ' Owner@Example.com ',
      headers: new Headers({
        'x-vercel-forwarded-for': '203.0.113.10',
        'x-forwarded-for': '198.51.100.4, 10.0.0.1',
      }),
      secret,
    });
    const second = buildOwnerPasswordRecoveryRateLimitKeys({
      email: 'owner@example.com',
      headers: new Headers({ 'x-forwarded-for': '203.0.113.10' }),
      secret,
    });

    expect(first).toEqual(second);
    expect(first.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.ipHash).not.toContain('203.0.113.10');
    expect(first.emailHash).not.toContain('owner@example.com');
    expect(first.ipHash).not.toBe(first.emailHash);
  });

  it('collapses malformed emails to one abuse key', () => {
    const input = { headers: new Headers(), secret: 'test-only-secret' };
    expect(buildOwnerPasswordRecoveryRateLimitKeys({ ...input, email: 'bad' }).emailHash)
      .toBe(buildOwnerPasswordRecoveryRateLimitKeys({ ...input, email: 'also-bad' }).emailHash);
  });

  it('fails closed when the rate limit store is unavailable', async () => {
    await expect(consumeOwnerPasswordRecoveryRateLimit({
      email: 'owner@example.com',
      headers: new Headers(),
      secret: 'test-only-secret',
      operations: { consumeRateLimit: vi.fn(async () => { throw new Error('unavailable'); }) },
    })).resolves.toBe(false);
  });

  it('rejects request bodies above the byte limit without parsing them', async () => {
    const request = new Request(`${appOrigin}/api`, {
      method: 'POST',
      body: JSON.stringify({ email: 'a'.repeat(OWNER_RECOVERY_BODY_LIMIT_BYTES) }),
    });
    await expect(readOwnerPasswordRecoveryEmail(request)).resolves.toBeNull();
  });

  it('reads a bounded email request body', async () => {
    const request = new Request(`${appOrigin}/api`, {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com' }),
    });
    await expect(readOwnerPasswordRecoveryEmail(request)).resolves.toBe('owner@example.com');
  });

  it.each([
    ['fast rejection', 0, 0, 1_200],
    ['valid owner path', 700, 0.5, 650],
    ['slow provider response', 1_600, 0.9, 0],
  ])('applies the same response floor to %s', async (_case, elapsed, random, expectedWait) => {
    const sleep = vi.fn(async () => undefined);
    await enforceOwnerPasswordRecoveryResponseFloor(1_000, {
      now: () => 1_000 + elapsed,
      random: () => random,
      sleep,
    });

    if (expectedWait === 0) {
      expect(sleep).not.toHaveBeenCalled();
    } else {
      expect(sleep).toHaveBeenCalledWith(expectedWait);
    }
  });
});
