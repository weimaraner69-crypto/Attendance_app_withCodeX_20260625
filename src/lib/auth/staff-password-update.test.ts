import { describe, expect, it, vi } from 'vitest';

import {
  updateStaffPasswordWithIntent,
  type StaffPasswordUpdateOperations,
} from './staff-password-update';

function operations(
  overrides: Partial<StaffPasswordUpdateOperations> = {}
): StaffPasswordUpdateOperations {
  return {
    findActiveIntent: vi.fn(async () => ({
      id: 'intent-1',
      user_id: 'auth-user-1',
      intent_type: 'recovery',
    })),
    hasValidStaffIdentity: vi.fn(async () => true),
    claimIntent: vi.fn(async () => true),
    updatePassword: vi.fn(async () => true),
    ...overrides,
  };
}

describe('DB-backed staff password intent', () => {
  it('claims the intent before updating the target Auth user', async () => {
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

    await expect(updateStaffPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: true, code: 'updated' });
    expect(order).toEqual(['claim', 'update']);
  });

  it('allows only one of two concurrent requests to claim the same intent', async () => {
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
      updateStaffPasswordWithIntent({ token: 'same-token', password: 'password-one', operations: deps }),
      updateStaffPasswordWithIntent({ token: 'same-token', password: 'password-two', operations: deps }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === 'already_consumed')).toHaveLength(1);
    expect(updatePassword).toHaveBeenCalledOnce();
  });

  it('fails closed before claiming when the staff identity is no longer valid', async () => {
    const deps = operations({ hasValidStaffIdentity: vi.fn(async () => false) });
    await expect(updateStaffPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.claimIntent).not.toHaveBeenCalled();
    expect(deps.updatePassword).not.toHaveBeenCalled();
  });

  it('does not retry password mutation after a consumed intent update fails', async () => {
    const deps = operations({ updatePassword: vi.fn(async () => false) });
    await expect(updateStaffPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'update_failed' });
    expect(deps.claimIntent).toHaveBeenCalledOnce();
  });
});
