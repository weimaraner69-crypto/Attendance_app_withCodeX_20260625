import { describe, expect, it, vi } from 'vitest';

import {
  hasValidOwnerAuthIdentity,
  hasValidOwnerAuthIdentityForUser,
  isValidOwnerEmail,
  normalizeOwnerEmail,
  type OwnerAuthIdentityOperations,
} from './owner-auth-identity';

const userId = 'owner-user-1';

function profile(overrides = {}) {
  return {
    id: userId,
    organization_id: 'organization-1',
    role: 'owner',
    email: ' Owner@Example.com ',
    is_active: true,
    ...overrides,
  };
}

function authUser(overrides = {}) {
  return {
    id: userId,
    email: 'owner@example.com',
    ...overrides,
  };
}

function operations(overrides: Partial<OwnerAuthIdentityOperations> = {}): OwnerAuthIdentityOperations {
  return {
    getProfile: vi.fn(async () => profile()),
    getAuthUser: vi.fn(async () => authUser()),
    ...overrides,
  };
}

describe('owner Auth identity', () => {
  it('normalizes email values before validation', () => {
    expect(normalizeOwnerEmail(' Owner@Example.com ')).toBe('owner@example.com');
    expect(normalizeOwnerEmail(null)).toBe('');
    expect(isValidOwnerEmail(' Owner@Example.com ')).toBe(true);
    expect(isValidOwnerEmail('not-an-email')).toBe(false);
  });

  it('accepts only an active owner profile with the matching Auth user and email', () => {
    expect(hasValidOwnerAuthIdentity({
      userId,
      profile: profile(),
      authUser: authUser(),
    })).toBe(true);
  });

  it.each([
    ['a non-owner profile', profile({ role: 'staff' }), authUser()],
    ['an inactive profile', profile({ is_active: false }), authUser()],
    ['a profile for another user', profile({ id: 'owner-user-2' }), authUser()],
    ['an Auth user for another user', profile(), authUser({ id: 'owner-user-2' })],
    ['a mismatched Auth email', profile(), authUser({ email: 'other@example.com' })],
    ['a malformed profile email', profile({ email: 'not-an-email' }), authUser({ email: 'not-an-email' })],
  ])('rejects %s', (_description, candidateProfile, candidateAuthUser) => {
    expect(hasValidOwnerAuthIdentity({
      userId,
      profile: candidateProfile,
      authUser: candidateAuthUser,
    })).toBe(false);
  });

  it('loads the profile and Auth user by the same user ID', async () => {
    const deps = operations();

    await expect(hasValidOwnerAuthIdentityForUser(userId, deps)).resolves.toBe(true);
    expect(deps.getProfile).toHaveBeenCalledWith(userId);
    expect(deps.getAuthUser).toHaveBeenCalledWith(userId);
  });

  it('fails closed without looking up Auth when the profile is not an active owner', async () => {
    const deps = operations({ getProfile: vi.fn(async () => profile({ role: 'manager' })) });

    await expect(hasValidOwnerAuthIdentityForUser(userId, deps)).resolves.toBe(false);
    expect(deps.getAuthUser).not.toHaveBeenCalled();
  });

  it('fails closed when an identity lookup throws', async () => {
    const deps = operations({
      getAuthUser: vi.fn(async () => {
        throw new Error('Auth unavailable');
      }),
    });

    await expect(hasValidOwnerAuthIdentityForUser(userId, deps)).resolves.toBe(false);
  });
});
