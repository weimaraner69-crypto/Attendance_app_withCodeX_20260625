import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase';

export type StaffAuthActionCode =
  | 'sent'
  | 'reset_sent'
  | 'invalid_staff'
  | 'inactive_staff'
  | 'missing_email'
  | 'invalid_email'
  | 'duplicate_email'
  | 'cross_organization'
  | 'wrong_role'
  | 'already_linked'
  | 'already_registered'
  | 'inconsistent_profile'
  | 'configuration_error'
  | 'invite_failed'
  | 'link_failed'
  | 'cleanup_failed'
  | 'reset_failed';

export type StaffAuthActionResult = {
  code: StaffAuthActionCode;
  ok: boolean;
};

export type StaffPasswordSession = {
  authenticated?: boolean;
  profile?: { role?: string };
  staff?: { id?: string } | null;
};

type StaffCandidate = {
  id: string;
  organization_id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  is_active: boolean;
};

type ProfileReference = {
  id: string;
  organization_id: string;
  role: Database['public']['Enums']['app_role'];
  email: string;
  is_active: boolean;
};

type StaffEmailReference = {
  id: string;
  auth_user_id: string | null;
};

export type StaffAuthOperations = {
  getStaff: (organizationId: string, staffId: string) => Promise<StaffCandidate | null>;
  getProfile: (userId: string) => Promise<ProfileReference | null>;
  findProfilesByEmail: (email: string) => Promise<ProfileReference[]>;
  findStaffByEmail: (organizationId: string, email: string) => Promise<StaffEmailReference[]>;
  inviteAuthUser: (email: string, redirectTo: string) => Promise<{ id: string } | null>;
  createStaffProfile: (input: {
    id: string;
    organizationId: string;
    displayName: string;
    email: string;
  }) => Promise<boolean>;
  linkStaff: (input: {
    staffId: string;
    organizationId: string;
    authUserId: string;
  }) => Promise<boolean>;
  deleteAuthUser: (userId: string) => Promise<boolean>;
  sendPasswordReset: (email: string, redirectTo: string) => Promise<boolean>;
  writeAuditLog: (input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    staffId: string;
  }) => Promise<void>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStaffEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function escapePostgrestLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function buildStaffPasswordUrl(appUrl: string | undefined) {
  if (!appUrl?.trim()) return null;

  try {
    const url = new URL(appUrl.trim());
    const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const validProtocol = url.protocol === 'https:' || (localHost && url.protocol === 'http:');
    const hasOriginOnlyPath = url.pathname === '/' && !url.search && !url.hash;

    if (!validProtocol || !hasOriginOnlyPath || url.username || url.password) {
      return null;
    }

    return new URL('/auth/staff-password', url.origin).toString();
  } catch {
    return null;
  }
}

export function isValidStaffPasswordSession(session: StaffPasswordSession) {
  return Boolean(
    session.authenticated &&
      session.profile?.role === 'staff' &&
      session.staff?.id
  );
}

function validateCandidate(candidate: StaffCandidate | null): StaffAuthActionResult | null {
  if (!candidate) return { ok: false, code: 'invalid_staff' };
  if (!candidate.is_active) return { ok: false, code: 'inactive_staff' };
  if (candidate.auth_user_id) return { ok: false, code: 'already_linked' };

  const email = normalizeStaffEmail(candidate.email);
  if (!email) return { ok: false, code: 'missing_email' };
  if (!emailPattern.test(email)) return { ok: false, code: 'invalid_email' };

  return null;
}

export async function inviteAndLinkStaff(input: {
  organizationId: string;
  actorUserId: string;
  staffId: string;
  redirectTo: string;
  operations: StaffAuthOperations;
}): Promise<StaffAuthActionResult> {
  const { organizationId, actorUserId, staffId, redirectTo, operations } = input;
  const candidate = await operations.getStaff(organizationId, staffId);
  const validation = validateCandidate(candidate);
  if (validation || !candidate) return validation ?? { ok: false, code: 'invalid_staff' };

  const email = normalizeStaffEmail(candidate.email);
  const [profiles, staffWithEmail] = await Promise.all([
    operations.findProfilesByEmail(email),
    operations.findStaffByEmail(organizationId, email),
  ]);

  if (profiles.some((profile) => profile.organization_id !== organizationId)) {
    return { ok: false, code: 'cross_organization' };
  }
  if (profiles.some((profile) => profile.role !== 'staff')) {
    return { ok: false, code: 'wrong_role' };
  }
  if (profiles.length > 0) {
    return { ok: false, code: 'already_registered' };
  }
  if (staffWithEmail.some((staff) => staff.id !== staffId)) {
    return { ok: false, code: 'duplicate_email' };
  }

  const invitedUser = await operations.inviteAuthUser(email, redirectTo);
  if (!invitedUser) return { ok: false, code: 'invite_failed' };

  const profileCreated = await operations.createStaffProfile({
    id: invitedUser.id,
    organizationId,
    displayName: candidate.name,
    email,
  });
  const staffLinked = profileCreated
    ? await operations.linkStaff({
        staffId,
        organizationId,
        authUserId: invitedUser.id,
      })
    : false;

  if (!profileCreated || !staffLinked) {
    const deleted = await operations.deleteAuthUser(invitedUser.id);
    return { ok: false, code: deleted ? 'link_failed' : 'cleanup_failed' };
  }

  await operations.writeAuditLog({
    organizationId,
    actorUserId,
    action: 'staff.auth_invited',
    staffId,
  });
  return { ok: true, code: 'sent' };
}

export async function requestStaffPasswordReset(input: {
  organizationId: string;
  actorUserId: string;
  staffId: string;
  redirectTo: string;
  operations: StaffAuthOperations;
}): Promise<StaffAuthActionResult> {
  const { organizationId, actorUserId, staffId, redirectTo, operations } = input;
  const candidate = await operations.getStaff(organizationId, staffId);
  if (!candidate) return { ok: false, code: 'invalid_staff' };
  if (!candidate.is_active) return { ok: false, code: 'inactive_staff' };
  if (!candidate.auth_user_id) return { ok: false, code: 'invalid_staff' };

  const email = normalizeStaffEmail(candidate.email);
  if (!email) return { ok: false, code: 'missing_email' };
  if (!emailPattern.test(email)) return { ok: false, code: 'invalid_email' };

  const profile = await operations.getProfile(candidate.auth_user_id);
  if (!profile || profile.organization_id !== organizationId) {
    return { ok: false, code: 'cross_organization' };
  }
  if (profile.role !== 'staff') return { ok: false, code: 'wrong_role' };
  if (!profile.is_active || normalizeStaffEmail(profile.email) !== email) {
    return { ok: false, code: 'inconsistent_profile' };
  }

  const sent = await operations.sendPasswordReset(email, redirectTo);
  if (!sent) return { ok: false, code: 'reset_failed' };

  await operations.writeAuditLog({
    organizationId,
    actorUserId,
    action: 'staff.password_reset_requested',
    staffId,
  });
  return { ok: true, code: 'reset_sent' };
}

export function createStaffAuthOperations(
  supabase: SupabaseClient<Database>
): StaffAuthOperations {
  return {
    async getStaff(organizationId, staffId) {
      const { data, error } = await supabase
        .from('staff')
        .select('id, organization_id, auth_user_id, name, email, is_active')
        .eq('id', staffId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async getProfile(userId) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, organization_id, role, email, is_active')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async findProfilesByEmail(email) {
      const emailLikePattern = escapePostgrestLikePattern(email);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, organization_id, role, email, is_active')
        .ilike('email', emailLikePattern);
      if (error) throw error;
      return data ?? [];
    },
    async findStaffByEmail(organizationId, email) {
      const emailLikePattern = escapePostgrestLikePattern(email);
      const { data, error } = await supabase
        .from('staff')
        .select('id, auth_user_id')
        .eq('organization_id', organizationId)
        .ilike('email', emailLikePattern);
      if (error) throw error;
      return data ?? [];
    },
    async inviteAuthUser(email, redirectTo) {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });
      return error || !data.user ? null : { id: data.user.id };
    },
    async createStaffProfile({ id, organizationId, displayName, email }) {
      const { error } = await supabase.from('user_profiles').insert({
        id,
        organization_id: organizationId,
        role: 'staff',
        display_name: displayName,
        email,
        is_active: true,
      });
      return !error;
    },
    async linkStaff({ staffId, organizationId, authUserId }) {
      const { data, error } = await supabase
        .from('staff')
        .update({ auth_user_id: authUserId })
        .eq('id', staffId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .is('auth_user_id', null)
        .select('id')
        .maybeSingle();
      return !error && Boolean(data);
    },
    async deleteAuthUser(userId) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      return !error;
    },
    async sendPasswordReset(email, redirectTo) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return !error;
    },
    async writeAuditLog({ organizationId, actorUserId, action, staffId }) {
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_user_id: actorUserId,
        action,
        target_table: 'staff',
        target_id: staffId,
        metadata: { auth_linked: action === 'staff.auth_invited' },
      });
    },
  };
}
