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
    claimIntent: vi.fn(async () => ({ id: 'intent-1', user_id: 'owner-user-1' })),
    updatePassword: vi.fn(async () => true),
    ...overrides,
  };
}

describe('DB-backed owner password intent', () => {
  it('claims the intent, revalidates identity, then updates the owner Auth user', async () => {
    const order: string[] = [];
    const deps = operations({
      claimIntent: vi.fn(async () => {
        order.push('claim');
        return { id: 'intent-1', user_id: 'owner-user-1' };
      }),
      hasValidOwnerIdentity: vi.fn(async () => {
        order.push('identity');
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
    expect(order).toEqual(['claim', 'identity', 'update']);
  });

  it('allows only one concurrent request to claim an intent', async () => {
    let claimed = false;
    const updatePassword = vi.fn(async () => true);
    const deps = operations({
      claimIntent: vi.fn(async () => {
        if (claimed) return null;
        claimed = true;
        return { id: 'intent-1', user_id: 'owner-user-1' };
      }),
      updatePassword,
    });

    const results = await Promise.all([
      updateOwnerPasswordWithIntent({ token: 'same-token', password: 'password-one', operations: deps }),
      updateOwnerPasswordWithIntent({ token: 'same-token', password: 'password-two', operations: deps }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === 'invalid_intent')).toHaveLength(1);
    expect(updatePassword).toHaveBeenCalledOnce();
  });

  it('consumes the intent and fails closed if the owner identity changed before update', async () => {
    const deps = operations({ hasValidOwnerIdentity: vi.fn(async () => false) });
    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.claimIntent).toHaveBeenCalledOnce();
    expect(deps.updatePassword).not.toHaveBeenCalled();
  });

  it('rechecks identity after a role change during the atomic claim', async () => {
    let identityValid = true;
    const deps = operations({
      claimIntent: vi.fn(async () => {
        identityValid = false;
        return { id: 'intent-1', user_id: 'owner-user-1' };
      }),
      hasValidOwnerIdentity: vi.fn(async () => identityValid),
    });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.updatePassword).not.toHaveBeenCalled();
  });
});
