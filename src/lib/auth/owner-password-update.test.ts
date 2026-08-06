import { describe, expect, it, vi } from 'vitest';

import {
  updateOwnerPasswordWithIntent,
  type OwnerPasswordUpdateOperations,
} from './owner-password-update';

function operations(
  overrides: Partial<OwnerPasswordUpdateOperations> = {}
): OwnerPasswordUpdateOperations {
  return {
    findActiveIntent: vi.fn(async () => ({ id: 'intent-1', user_id: 'owner-user-1' })),
    hasValidOwnerIdentity: vi.fn(async () => true),
    claimIntent: vi.fn(async () => true),
    updatePassword: vi.fn(async () => true),
    ...overrides,
  };
}

describe('DB-backed owner password intent', () => {
  it('claims the intent before updating the owner Auth user', async () => {
    const order: string[] = [];
    const deps = operations({
      claimIntent: vi.fn(async () => {
        order.push('claim');
        return true;
      }),
      updatePassword: vi.fn(async () => {
        order.push('update');
        return true;
      }),
    });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: true, code: 'updated' });
    expect(order).toEqual(['claim', 'update']);
  });

  it('allows only one concurrent request to claim an intent', async () => {
    let claimed = false;
    const updatePassword = vi.fn(async () => true);
    const deps = operations({
      claimIntent: vi.fn(async () => {
        if (claimed) return false;
        claimed = true;
        return true;
      }),
      updatePassword,
    });

    const results = await Promise.all([
      updateOwnerPasswordWithIntent({ token: 'same-token', password: 'password-one', operations: deps }),
      updateOwnerPasswordWithIntent({ token: 'same-token', password: 'password-two', operations: deps }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === 'already_consumed')).toHaveLength(1);
    expect(updatePassword).toHaveBeenCalledOnce();
  });

  it('fails closed before claiming if the owner identity changed', async () => {
    const deps = operations({ hasValidOwnerIdentity: vi.fn(async () => false) });
    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.claimIntent).not.toHaveBeenCalled();
    expect(deps.updatePassword).not.toHaveBeenCalled();
  });
});
