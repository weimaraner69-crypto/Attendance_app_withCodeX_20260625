import { describe, expect, it, vi } from 'vitest';

import {
  confirmOwnerPasswordRecoveryLink,
  type OwnerAuthConfirmationOperations,
} from './owner-auth-confirmation';

const origin = ['https:', '', 'attendance.example'].join('/');

function operations(
  overrides: Partial<OwnerAuthConfirmationOperations> = {}
): OwnerAuthConfirmationOperations {
  return {
    verifyRecoveryOtp: vi.fn(async () => 'owner-user-1'),
    hasValidOwnerIdentity: vi.fn(async () => true),
    createIntent: vi.fn(async () => true),
    ...overrides,
  };
}

describe('owner recovery confirmation', () => {
  it('issues an intent only after OTP and owner identity validation', async () => {
    const order: string[] = [];
    const deps = operations({
      verifyRecoveryOtp: vi.fn(async () => {
        order.push('otp');
        return 'owner-user-1';
      }),
      hasValidOwnerIdentity: vi.fn(async () => {
        order.push('identity');
        return true;
      }),
      createIntent: vi.fn(async () => {
        order.push('intent');
        return true;
      }),
    });

    await expect(confirmOwnerPasswordRecoveryLink(
      `${origin}/auth/owner-confirm/complete?token_hash=token-hash&type=recovery`,
      deps
    )).resolves.toEqual({ ok: true, userId: 'owner-user-1' });
    expect(order).toEqual(['otp', 'identity', 'intent']);
  });

  it.each(['invite', 'email', ''])('rejects the non-recovery type %s', async (type) => {
    const deps = operations();
    await expect(confirmOwnerPasswordRecoveryLink(
      `${origin}/auth/owner-confirm/complete?token_hash=token-hash&type=${type}`,
      deps
    )).resolves.toEqual({ ok: false, code: 'invalid_parameters' });
    expect(deps.verifyRecoveryOtp).not.toHaveBeenCalled();
  });

  it('does not issue an intent for a non-owner identity', async () => {
    const deps = operations({ hasValidOwnerIdentity: vi.fn(async () => false) });
    await expect(confirmOwnerPasswordRecoveryLink(
      `${origin}/auth/owner-confirm/complete?token_hash=token-hash&type=recovery`,
      deps
    )).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.createIntent).not.toHaveBeenCalled();
  });
});
