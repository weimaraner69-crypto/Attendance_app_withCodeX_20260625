import { describe, expect, it, vi } from 'vitest';

import {
  confirmStaffAuthLink,
  type StaffAuthConfirmationOperations,
} from './staff-auth-confirmation';

function operations(
  overrides: Partial<StaffAuthConfirmationOperations> = {}
): StaffAuthConfirmationOperations {
  return {
    verifyOtp: vi.fn(async () => 'auth-user-1'),
    hasValidStaffIdentity: vi.fn(async () => true),
    createIntent: vi.fn(async () => true),
    ...overrides,
  };
}

describe('staff Auth email confirmation', () => {
  it.each(['invite', 'recovery'] as const)(
    'verifies a %s token and starts a password intent',
    async (type) => {
      const deps = operations();
      await expect(confirmStaffAuthLink(
        `https://attendance.example.com/auth/confirm?token_hash=token-hash&type=${type}`,
        deps
      )).resolves.toEqual({ ok: true, type, userId: 'auth-user-1' });
      expect(deps.verifyOtp).toHaveBeenCalledWith('token-hash', type);
      expect(deps.createIntent).toHaveBeenCalledWith('auth-user-1', type);
    }
  );

  it('rejects missing, unsupported, expired, or reused token inputs', async () => {
    const invalidParameters = operations();
    await expect(confirmStaffAuthLink(
      'https://attendance.example.com/auth/confirm?type=signup',
      invalidParameters
    )).resolves.toEqual({ ok: false, code: 'invalid_parameters' });
    expect(invalidParameters.verifyOtp).not.toHaveBeenCalled();

    const invalidToken = operations({ verifyOtp: vi.fn(async () => null) });
    await expect(confirmStaffAuthLink(
      'https://attendance.example.com/auth/confirm?token_hash=used&type=recovery',
      invalidToken
    )).resolves.toEqual({ ok: false, code: 'invalid_token' });
    expect(invalidToken.createIntent).not.toHaveBeenCalled();
  });

  it('fails closed when staff and profile are not in the same organization', async () => {
    const deps = operations({ hasValidStaffIdentity: vi.fn(async () => false) });
    await expect(confirmStaffAuthLink(
      'https://attendance.example.com/auth/confirm?token_hash=token-hash&type=invite',
      deps
    )).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.createIntent).not.toHaveBeenCalled();
  });

  it('fails closed when the atomic password intent cannot be issued', async () => {
    const deps = operations({ createIntent: vi.fn(async () => false) });
    await expect(confirmStaffAuthLink(
      'https://attendance.example.com/auth/confirm?token_hash=token-hash&type=recovery',
      deps
    )).resolves.toEqual({ ok: false, code: 'intent_failed' });
  });
});
