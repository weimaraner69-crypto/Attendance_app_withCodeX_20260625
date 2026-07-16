import { describe, expect, it, vi } from 'vitest';

import {
  buildStaffPasswordUrl,
  createStaffAuthOperations,
  escapePostgrestLikePattern,
  inviteAndLinkStaff,
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
    getAuthUser: vi.fn(async () => ({
      id: 'auth-1',
      email: 'staff@example.com',
    })),
    findProfilesByEmail: vi.fn(async () => []),
    findStaffByEmail: vi.fn(async () => [{ id: staffId, auth_user_id: null }]),
    inviteAuthUser: vi.fn(async () => ({ id: 'auth-1' })),
    createStaffProfile: vi.fn(async () => true),
    linkStaff: vi.fn(async () => true),
    deleteAuthUser: vi.fn(async () => true),
    sendPasswordReset: vi.fn(async () => true),
    writeAuditLog: vi.fn(async () => true),
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
      staffId,
      organizationId,
      displayName: '田中 太郎',
      email: 'staff@example.com',
    });
    expect(operations.linkStaff).toHaveBeenCalledWith({
      staffId,
      organizationId,
      authUserId: 'auth-1',
      expectedStaffEmail: ' Staff@Example.com ',
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

  it('fails linking when the staff email changes after the invitation starts', async () => {
    let currentStaffEmail = ' Staff@Example.com ';
    const operations = createOperations({
      inviteAuthUser: vi.fn(async () => {
        currentStaffEmail = 'changed@example.com';
        return { id: 'auth-1' };
      }),
      linkStaff: vi.fn(async ({ expectedStaffEmail }) => (
        expectedStaffEmail === currentStaffEmail
      )),
    });

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

  it.each([
    ['profile creation throws', {
      createStaffProfile: vi.fn(async () => {
        throw new Error('profile unavailable');
      }),
    }],
    ['staff linking throws', {
      linkStaff: vi.fn(async () => {
        throw new Error('staff unavailable');
      }),
    }],
  ])('compensates when %s', async (_description, overrides) => {
    const operations = createOperations(overrides);

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'link_failed' });
    expect(operations.deleteAuthUser).toHaveBeenCalledWith('auth-1');
    expect(operations.writeAuditLog).not.toHaveBeenCalled();
  });

  it('reports cleanup failure when Auth deletion throws', async () => {
    const operations = createOperations({
      linkStaff: vi.fn(async () => false),
      deleteAuthUser: vi.fn(async () => {
        throw new Error('Auth unavailable');
      }),
    });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'cleanup_failed' });
    expect(operations.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ['returns a partial success when the audit insert reports failure', vi.fn(async () => false)],
    ['returns a partial success when the audit insert throws', vi.fn(async () => {
      throw new Error('audit unavailable');
    })],
  ])('%s', async (_description, writeAuditLog) => {
    const operations = createOperations({ writeAuditLog });

    await expect(invite(operations)).resolves.toEqual({ ok: false, code: 'invite_audit_failed' });
    expect(operations.inviteAuthUser).toHaveBeenCalled();
    expect(operations.linkStaff).toHaveBeenCalled();
  });
});

describe('staff Auth Supabase adapter', () => {
  it('pins staff linking to organization, active state, original email, and null Auth ID', async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { id: staffId }, error: null })),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.select.mockReturnValue(query);

    const supabase = {
      from: vi.fn(() => query),
      auth: { admin: {}, resetPasswordForEmail: vi.fn() },
      rpc: vi.fn(),
    };
    const operations = createStaffAuthOperations(
      supabase as unknown as Parameters<typeof createStaffAuthOperations>[0]
    );

    await expect(operations.linkStaff({
      staffId,
      organizationId,
      authUserId: 'auth-1',
      expectedStaffEmail: ' Staff@Example.com ',
    })).resolves.toBe(true);

    expect(query.eq).toHaveBeenCalledWith('id', staffId);
    expect(query.eq).toHaveBeenCalledWith('organization_id', organizationId);
    expect(query.eq).toHaveBeenCalledWith('is_active', true);
    expect(query.eq).toHaveBeenCalledWith('email', ' Staff@Example.com ');
    expect(query.is).toHaveBeenCalledWith('auth_user_id', null);
  });

  it('creates a staff profile through the serialized email-guard RPC', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const supabase = {
      from: vi.fn(),
      auth: { admin: {}, resetPasswordForEmail: vi.fn() },
      rpc,
    };
    const operations = createStaffAuthOperations(
      supabase as unknown as Parameters<typeof createStaffAuthOperations>[0]
    );

    await expect(operations.createStaffProfile({
      id: 'auth-1',
      staffId,
      organizationId,
      displayName: '田中 太郎',
      email: 'staff@example.com',
    })).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('create_staff_profile_with_email_guard', {
      p_user_id: 'auth-1',
      p_staff_id: staffId,
      p_organization_id: organizationId,
      p_display_name: '田中 太郎',
      p_email: 'staff@example.com',
    });
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

  it.each([
    ['a missing Auth user', null],
    ['an Auth user with a different ID', { id: 'auth-2', email: 'staff@example.com' }],
    ['an Auth user with a different email', { id: 'auth-1', email: 'other@example.com' }],
  ])('rejects %s before sending a reset', async (_description, authUser) => {
    const operations = createOperations({
      getStaff: vi.fn(async () => ({
        id: staffId,
        organization_id: organizationId,
        auth_user_id: 'auth-1',
        name: '田中 太郎',
        email: 'staff@example.com',
        is_active: true,
      })),
      getAuthUser: vi.fn(async () => authUser),
    });

    await expect(requestStaffPasswordReset({
      organizationId,
      actorUserId,
      staffId,
      redirectTo,
      operations,
    })).resolves.toEqual({ ok: false, code: 'inconsistent_profile' });
    expect(operations.sendPasswordReset).not.toHaveBeenCalled();
  });

  it.each([
    ['returns a partial success when the audit insert reports failure', vi.fn(async () => false)],
    ['returns a partial success when the audit insert throws', vi.fn(async () => {
      throw new Error('audit unavailable');
    })],
  ])('%s', async (_description, writeAuditLog) => {
    const operations = createOperations({
      getStaff: vi.fn(async () => ({
        id: staffId,
        organization_id: organizationId,
        auth_user_id: 'auth-1',
        name: '田中 太郎',
        email: 'staff@example.com',
        is_active: true,
      })),
      writeAuditLog,
    });

    await expect(requestStaffPasswordReset({
      organizationId,
      actorUserId,
      staffId,
      redirectTo,
      operations,
    })).resolves.toEqual({ ok: false, code: 'reset_audit_failed' });
    expect(operations.sendPasswordReset).toHaveBeenCalledWith('staff@example.com', redirectTo);
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

});

describe('case-insensitive email lookup', () => {
  it('escapes every PostgreSQL LIKE wildcard and escape character', () => {
    expect(escapePostgrestLikePattern('staff_name%test\\mail@example.com')).toBe(
      'staff\\_name\\%test\\\\mail@example.com'
    );
  });
});
