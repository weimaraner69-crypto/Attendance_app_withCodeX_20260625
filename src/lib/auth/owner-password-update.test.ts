import { describe, expect, it, vi } from 'vitest';

import {
  classifyOwnerAuthUpdateError,
  updateOwnerPasswordWithIntent,
  type OwnerPasswordUpdateOperations,
} from './owner-password-update';

describe('owner Auth update error classification', () => {
  it.each([400, 401, 409, 422, 429])(
    'treats HTTP %s as an explicit rejection',
    (status) => {
      expect(classifyOwnerAuthUpdateError(status)).toBe('rejected');
    }
  );

  it.each([undefined, null, 399, 500, 503, '500'])(
    'treats %s as an unknown update result',
    (status) => {
      expect(classifyOwnerAuthUpdateError(status)).toBe('unknown');
    }
  );
});

function operations(
  overrides: Partial<OwnerPasswordUpdateOperations> = {}
): OwnerPasswordUpdateOperations {
  return {
    findActiveIntent: vi.fn(async () => ({ id: 'intent-1', user_id: 'owner-user-1' })),
    hasValidOwnerIdentity: vi.fn(async () => true),
    claimIntent: vi.fn(async () => ({ id: 'intent-1', user_id: 'owner-user-1' })),
    releaseIntent: vi.fn(async () => true),
    finalizeIntent: vi.fn(async () => true),
    quarantineIntent: vi.fn(async () => true),
    updatePassword: vi.fn(async () => 'updated'),
    disableAuthCredentials: vi.fn(async () => true),
    ...overrides,
  };
}

describe('DB-backed owner password intent', () => {
  it('claims, checks identity immediately around the Auth update, then finalizes', async () => {
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
        return 'updated';
      }),
      finalizeIntent: vi.fn(async () => {
        order.push('finalize');
        return true;
      }),
    });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: true, code: 'updated' });
    expect(order).toEqual(['claim', 'identity', 'update', 'identity', 'finalize']);
    expect(deps.claimIntent).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(deps.finalizeIntent).toHaveBeenCalledWith(
      'intent-1',
      expect.any(String),
      'updated'
    );
  });

  it('allows only one concurrent request to claim an intent', async () => {
    let claimed = false;
    const updatePassword = vi.fn(async () => 'updated' as const);
    const deps = operations({
      claimIntent: vi.fn(async () => {
        if (claimed) return 'busy';
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
    expect(results.filter((result) => !result.ok && result.code === 'claim_busy')).toHaveLength(1);
    expect(updatePassword).toHaveBeenCalledOnce();
  });

  it('keeps a busy claim distinct from an invalid or consumed intent', async () => {
    const deps = operations({ claimIntent: vi.fn(async () => 'busy') });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'claim_busy' });
    expect(deps.hasValidOwnerIdentity).not.toHaveBeenCalled();
    expect(deps.updatePassword).not.toHaveBeenCalled();
  });

  it('finalizes the intent without updating if identity is invalid before update', async () => {
    const deps = operations({ hasValidOwnerIdentity: vi.fn(async () => false) });
    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.claimIntent).toHaveBeenCalledOnce();
    expect(deps.updatePassword).not.toHaveBeenCalled();
    expect(deps.finalizeIntent).toHaveBeenCalledWith(
      'intent-1',
      expect.any(String),
      'identity_changed'
    );
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

  it('releases the claim after an explicit Auth rejection so the link can be retried', async () => {
    const deps = operations({
      updatePassword: vi.fn(async () => 'rejected'),
    });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'update_failed_retryable' });
    expect(deps.releaseIntent).toHaveBeenCalledWith('intent-1', expect.any(String));
    expect(deps.finalizeIntent).not.toHaveBeenCalled();
    expect(deps.disableAuthCredentials).not.toHaveBeenCalled();
  });

  it('quarantines the profile and disables Auth credentials after an unknown update result', async () => {
    const deps = operations({
      updatePassword: vi.fn(async () => 'unknown'),
    });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'update_unknown' });
    expect(deps.quarantineIntent).toHaveBeenCalledWith(
      'intent-1',
      expect.any(String),
      'update_unknown'
    );
    expect(deps.disableAuthCredentials).toHaveBeenCalledWith('owner-user-1');
  });

  it('compensates if identity changes after the Auth password update', async () => {
    const hasValidOwnerIdentity = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const deps = operations({ hasValidOwnerIdentity });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'invalid_identity' });
    expect(deps.quarantineIntent).toHaveBeenCalledWith(
      'intent-1',
      expect.any(String),
      'identity_changed'
    );
    expect(deps.disableAuthCredentials).toHaveBeenCalledWith('owner-user-1');
    expect(deps.finalizeIntent).not.toHaveBeenCalled();
  });

  it('fails closed when either post-update compensation barrier fails', async () => {
    const deps = operations({
      updatePassword: vi.fn(async () => 'unknown'),
      quarantineIntent: vi.fn(async () => false),
    });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'compensation_failed' });
    expect(deps.disableAuthCredentials).toHaveBeenCalledOnce();
  });

  it('does not report success unless the claimed intent is finalized', async () => {
    const deps = operations({ finalizeIntent: vi.fn(async () => false) });

    await expect(updateOwnerPasswordWithIntent({
      token: 'opaque-token',
      password: 'new-password',
      operations: deps,
    })).resolves.toEqual({ ok: false, code: 'finalize_failed' });
  });
});
