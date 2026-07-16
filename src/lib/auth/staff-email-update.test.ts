import { describe, expect, it } from 'vitest';

import { isStaffEmailAvailable, resolveStaffEmailUpdate } from './staff-email-update';

describe('staff email update protection', () => {
  it.each(['changed@example.com', 'linked@example.com', '', null])(
    'preserves the current email for linked staff when submitted value is %j',
    (submittedEmail) => {
      expect(resolveStaffEmailUpdate({
        authUserId: 'auth-user-1',
        currentEmail: 'linked@example.com',
      }, submittedEmail)).toBe('linked@example.com');
    }
  );

  it('accepts and normalizes an email for unlinked staff', () => {
    expect(resolveStaffEmailUpdate({
      authUserId: null,
      currentEmail: 'old@example.com',
    }, ' New@Example.com ')).toBe('new@example.com');
  });

  it.each(['', '   ', null])('clears an unlinked staff email for %j', (submittedEmail) => {
    expect(resolveStaffEmailUpdate({
      authUserId: null,
      currentEmail: 'old@example.com',
    }, submittedEmail)).toBeNull();
  });
});

describe('staff email collision checks', () => {
  const operations = {
    findProfilesByEmail: async () => [],
    findStaffByEmail: async () => [{ id: 'staff-1', auth_user_id: null }],
  };

  it('allows the current unlinked staff row to retain its own normalized email', async () => {
    await expect(isStaffEmailAvailable({
      operations,
      organizationId: 'org-1',
      staffId: 'staff-1',
      email: ' Staff@Example.com ',
    })).resolves.toBe(true);
  });

  it('rejects profile and other-staff collisions', async () => {
    await expect(isStaffEmailAvailable({
      operations: {
        findProfilesByEmail: async () => [{
          id: 'auth-1',
          organization_id: 'org-1',
          role: 'staff',
          email: 'staff@example.com',
          is_active: true,
        }],
        findStaffByEmail: async () => [],
      },
      organizationId: 'org-1',
      staffId: 'staff-1',
      email: 'staff@example.com',
    })).resolves.toBe(false);

    await expect(isStaffEmailAvailable({
      operations: {
        findProfilesByEmail: async () => [],
        findStaffByEmail: async () => [{ id: 'staff-2', auth_user_id: null }],
      },
      organizationId: 'org-1',
      staffId: 'staff-1',
      email: 'staff@example.com',
    })).resolves.toBe(false);
  });

  it('allows an empty email without issuing collision queries', async () => {
    let queried = false;
    await expect(isStaffEmailAvailable({
      operations: {
        findProfilesByEmail: async () => {
          queried = true;
          return [];
        },
        findStaffByEmail: async () => {
          queried = true;
          return [];
        },
      },
      organizationId: 'org-1',
      email: null,
    })).resolves.toBe(true);
    expect(queried).toBe(false);
  });
});
