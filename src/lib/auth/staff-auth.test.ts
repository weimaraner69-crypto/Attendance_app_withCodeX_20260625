import { describe, expect, it, vi } from 'vitest';

import {
  buildStaffPasswordUrl,
  escapePostgrestLikePattern,
  inviteAndLinkStaff,
  isValidStaffPasswordSession,
  requestStaffPasswordReset,
  type StaffAuthOperations,
} from './staff-auth';

const organizationId = 'org-1';
const actorUserId = 'owner-1';
const staffId = 'staff-1';
const redirectTo = 'https://attendance.example.com/auth/staff-password';

function createOperations(overrides: Partial<StaffAuthOperations> = {}): StaffAuthOperations {
  return {
    getStaff: vi.fn(async () => ({
      id: staffId,
      organization_id: organizationId,
      auth_user_id: null,
      name: '田中 太郎',
      email: ' Staff@Example.com ',
      is_active: true,
    })),
    getProfile: vi.fn(async () => ({
      id: 'auth-1',
      organization_id: organizationId,
      role: 'staff',
      email: 'staff@example.com',
      is_active: true,
    })),
    findProfilesByEmail: vi.fn(async () => []),
    findStaffByEmail: vi.fn(async () => [{ id: staffId, auth_user_id: null }]),
    inviteAuthUser: vi.fn(async () => ({ id: 'auth-1' })),
    createStaffProfile: vi.fn(async () => true),
    linkStaff: vi.fn(async () => true),
    deleteAuthUser: vi.fn(async () => true),
    sendPasswordReset: vi.fn(async () => true),
    writeAuditLog: vi.fn(async () => undefined),
    ...overrides,
  };
}

function invite(operations: StaffAuthOperations) {
  return inviteAndLinkStaff({
    organizationId,
    actorUserId,
    staffId,
    redirectTo,
    operations,
  });
}

describe('staff invitation and linking', () => {
  it('uses only the Auth user ID returned by the invitation API', async () => {
    const operations = createOperations();

    await expect(invite(operations)).resolves.toEqual({ ok: true, code: 'sent' });
    expect(operations.inviteAuthUser).toHaveBeenCalledWith('staff@example.com', redirectTo);
    expect(operations.createStaffProfile).toHaveBeenCalledWith({
      id: 'auth-1',
      organizationId,
      displayName: '田中 太郎',
      email: 'staff@example.com',
    });
    expect(operations.linkStaff).toHaveBeenCalledWith({
      staffId,
      organizationId,
      authUserId: 'auth-1',
    });
    expect(operations.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('rejects disabled staff before creating an Auth user', async () => {
    const operations = createOperations({
      getStaff: vi.fn(async () => ({
        id: staffId,
        organization_id: organizationId,
        auth_user_id: null,
        name: '田中 太郎',
        email: 'staff@example.com',
        is_active: false,
      })),
    });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'inactive_staff' });
    expect(operations.inviteAuthUser).not.toHaveBeenCalled();
  });

  it('rejects an email already assigned to another organization', async () => {
    const operations = createOperations({
      findProfilesByEmail: vi.fn(async () => [{
        id: 'other-user',
        organization_id: 'other-org',
        role: 'staff',
        email: 'staff@example.com',
        is_active: true,
      }]),
    });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'cross_organization' });
    expect(operations.inviteAuthUser).not.toHaveBeenCalled();
  });

  it('rejects an email assigned to a non-staff role', async () => {
    const operations = createOperations({
      findProfilesByEmail: vi.fn(async () => [{
        id: 'manager-user',
        organization_id: organizationId,
        role: 'manager',
        email: 'staff@example.com',
        is_active: true,
      }]),
    });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'wrong_role' });
    expect(operations.inviteAuthUser).not.toHaveBeenCalled();
  });

  it('rejects a duplicate staff email and an already-linked staff row', async () => {
    const duplicateOperations = createOperations({
      findStaffByEmail: vi.fn(async () => [
        { id: staffId, auth_user_id: null },
        { id: 'staff-2', auth_user_id: null },
      ]),
    });
    await expect(invite(duplicateOperations)).resolves.toEqual({ ok: false, code: 'duplicate_email' });

    const linkedOperations = createOperations({
      getStaff: vi.fn(async () => ({
        id: staffId,
        organization_id: organizationId,
        auth_user_id: 'existing-auth',
        name: '田中 太郎',
        email: 'staff@example.com',
        is_active: true,
      })),
    });
    await expect(invite(linkedOperations)).resolves.toEqual({ ok: false, code: 'already_linked' });
  });

  it('rejects malformed email addresses', async () => {
    const operations = createOperations({
      getStaff: vi.fn(async () => ({
        id: staffId,
        organization_id: organizationId,
        auth_user_id: null,
        name: '田中 太郎',
        email: 'not-an-email',
        is_active: true,
      })),
    });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'invalid_email' });
    expect(operations.inviteAuthUser).not.toHaveBeenCalled();
  });

  it('fails closed when collision checks cannot be completed', async () => {
    const operations = createOperations({
      findProfilesByEmail: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    });

    await expect(invite(operations)).rejects.toThrow('database unavailable');
    expect(operations.inviteAuthUser).not.toHaveBeenCalled();
  });

  it('deletes the newly invited Auth user when database linking fails', async () => {
    const operations = createOperations({ linkStaff: vi.fn(async () => false) });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'link_failed' });
    expect(operations.deleteAuthUser).toHaveBeenCalledWith('auth-1');
    expect(operations.writeAuditLog).not.toHaveBeenCalled();
  });

  it('reports a cleanup failure when a partially created Auth user remains', async () => {
    const operations = createOperations({
      createStaffProfile: vi.fn(async () => false),
      deleteAuthUser: vi.fn(async () => false),
    });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'cleanup_failed' });
    expect(operations.deleteAuthUser).toHaveBeenCalledWith('auth-1');
  });
});

describe('staff password reset', () => {
  it('sends a reset only for an active, linked, matching staff profile', async () => {
    const operations = createOperations({
      getStaff: vi.fn(async () => ({
        id: staffId,
        organization_id: organizationId,
        auth_user_id: 'auth-1',
        name: '田中 太郎',
        email: 'staff@example.com',
        is_active: true,
      })),
    });

    await expect(requestStaffPasswordReset({
      organizationId,
      actorUserId,
      staffId,
      redirectTo,
      operations,
    })).resolves.toEqual({ ok: true, code: 'reset_sent' });
    expect(operations.sendPasswordReset).toHaveBeenCalledWith('staff@example.com', redirectTo);
  });

  it('rejects a linked profile with a different role', async () => {
    const operations = createOperations({
      getStaff: vi.fn(async () => ({
        id: staffId,
        organization_id: organizationId,
        auth_user_id: 'auth-1',
        name: '田中 太郎',
        email: 'staff@example.com',
        is_active: true,
      })),
      getProfile: vi.fn(async () => ({
        id: 'auth-1',
        organization_id: organizationId,
        role: 'owner',
        email: 'staff@example.com',
        is_active: true,
      })),
    });

    await expect(requestStaffPasswordReset({
      organizationId,
      actorUserId,
      staffId,
      redirectTo,
      operations,
    })).resolves.toEqual({ ok: false, code: 'wrong_role' });
    expect(operations.sendPasswordReset).not.toHaveBeenCalled();
  });
});

describe('staff password redirect URL', () => {
  it('accepts HTTPS origins and local development origins only', () => {
    expect(buildStaffPasswordUrl('https://attendance.example.com')).toBe(
      'https://attendance.example.com/auth/staff-password'
    );
    expect(buildStaffPasswordUrl('http://localhost:3000')).toBe(
      'http://localhost:3000/auth/staff-password'
    );
    expect(buildStaffPasswordUrl('http://attendance.example.com')).toBeNull();
    expect(buildStaffPasswordUrl('ftp://localhost')).toBeNull();
    expect(buildStaffPasswordUrl('https://attendance.example.com/other')).toBeNull();
    expect(buildStaffPasswordUrl(undefined)).toBeNull();
  });

  it('rejects expired, reused, and non-staff link sessions', () => {
    expect(isValidStaffPasswordSession({ authenticated: false })).toBe(false);
    expect(isValidStaffPasswordSession({
      authenticated: true,
      profile: { role: 'owner' },
      staff: null,
    })).toBe(false);
    expect(isValidStaffPasswordSession({
      authenticated: true,
      profile: { role: 'staff' },
      staff: { id: 'staff-1' },
    })).toBe(true);
  });
});

describe('case-insensitive email lookup', () => {
  it('escapes every PostgreSQL LIKE wildcard and escape character', () => {
    expect(escapePostgrestLikePattern('staff_name%test\\mail@example.com')).toBe(
      'staff\\_name\\%test\\\\mail@example.com'
    );
  });
});
