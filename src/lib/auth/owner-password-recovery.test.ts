import { describe, expect, it, vi } from 'vitest';

import {
  buildOwnerPasswordRecoveryUrl,
  requestOwnerPasswordRecovery,
  type OwnerPasswordRecoveryOperations,
} from './owner-password-recovery';

const redirectTo = 'https://attendance.example.com/auth/owner-confirm';
const ownerProfile = {
  id: 'owner-user-1',
  organization_id: 'organization-1',
  role: 'owner',
  email: ' Owner@Example.com ',
  is_active: true,
};
const ownerAuthUser = { id: 'owner-user-1', email: 'owner@example.com' };

function operations(
  overrides: Partial<OwnerPasswordRecoveryOperations> = {}
): OwnerPasswordRecoveryOperations {
  return {
    findProfilesByEmail: vi.fn(async () => [ownerProfile]),
    getAuthUser: vi.fn(async () => ownerAuthUser),
    sendPasswordReset: vi.fn(async () => true),
    ...overrides,
  };
}

function request(email: string | null | undefined, deps: OwnerPasswordRecoveryOperations) {
  return requestOwnerPasswordRecovery({ email, redirectTo, operations: deps });
}

describe('owner self-service password recovery', () => {
  it('builds only an HTTPS or local owner confirmation URL', () => {
    expect(buildOwnerPasswordRecoveryUrl('https://attendance.example.com')).toBe(
      'https://attendance.example.com/auth/owner-confirm'
    );
    expect(buildOwnerPasswordRecoveryUrl('http://localhost:3000')).toBe(
      'http://localhost:3000/auth/owner-confirm'
    );
    expect(buildOwnerPasswordRecoveryUrl('http://attendance.example.com')).toBeNull();
    expect(buildOwnerPasswordRecoveryUrl('https://attendance.example.com/other')).toBeNull();
    expect(buildOwnerPasswordRecoveryUrl(undefined)).toBeNull();
  });

  it('sends a reset only for a single active owner with a matching Auth email', async () => {
    const deps = operations();

    await expect(request(' OWNER@example.com ', deps)).resolves.toEqual({ accepted: true });
    expect(deps.findProfilesByEmail).toHaveBeenCalledWith('owner@example.com');
    expect(deps.getAuthUser).toHaveBeenCalledWith('owner-user-1');
    expect(deps.sendPasswordReset).toHaveBeenCalledWith('owner@example.com', redirectTo);
  });

  it.each([
    ['an empty email', '', {}],
    ['a malformed email', 'not-an-email', {}],
    ['no profile', 'owner@example.com', { findProfilesByEmail: vi.fn(async () => []) }],
    ['multiple profiles', 'owner@example.com', { findProfilesByEmail: vi.fn(async () => [ownerProfile, { ...ownerProfile, id: 'owner-user-2' }]) }],
    ['a staff profile', 'owner@example.com', { findProfilesByEmail: vi.fn(async () => [{ ...ownerProfile, role: 'staff' }]) }],
    ['an inactive owner', 'owner@example.com', { findProfilesByEmail: vi.fn(async () => [{ ...ownerProfile, is_active: false }]) }],
    ['a profile email mismatch', 'owner@example.com', { findProfilesByEmail: vi.fn(async () => [{ ...ownerProfile, email: 'other@example.com' }]) }],
    ['an Auth email mismatch', 'owner@example.com', { getAuthUser: vi.fn(async () => ({ ...ownerAuthUser, email: 'other@example.com' })) }],
    ['an Auth user ID mismatch', 'owner@example.com', { getAuthUser: vi.fn(async () => ({ ...ownerAuthUser, id: 'owner-user-2' })) }],
    ['a profile lookup failure', 'owner@example.com', { findProfilesByEmail: vi.fn(async () => { throw new Error('database unavailable'); }) }],
    ['an Auth lookup failure', 'owner@example.com', { getAuthUser: vi.fn(async () => { throw new Error('Auth unavailable'); }) }],
  ])('returns the same public result for %s', async (_description, email, overrides) => {
    const deps = operations(overrides);

    await expect(request(email, deps)).resolves.toEqual({ accepted: true });
    expect(deps.sendPasswordReset).not.toHaveBeenCalled();
  });

  it.each([
    ['returns a delivery failure', vi.fn(async () => false)],
    ['throws while sending', vi.fn(async () => { throw new Error('mail unavailable'); })],
  ])('does not expose a request that %s', async (_description, sendPasswordReset) => {
    const deps = operations({ sendPasswordReset });

    await expect(request('owner@example.com', deps)).resolves.toEqual({ accepted: true });
    expect(deps.sendPasswordReset).toHaveBeenCalledOnce();
  });
});
