import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase';

import type { OwnerAuthIdentityOperations } from './owner-auth-identity';
import type { OwnerPasswordRecoveryOperations } from './owner-password-recovery';

function escapePostgrestLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function createOwnerAuthIdentityOperations(
  admin: SupabaseClient<Database>
): OwnerAuthIdentityOperations {
  return {
    async getProfile(userId) {
      const { data, error } = await admin
        .from('user_profiles')
        .select('id, organization_id, role, email, is_active')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async getAuthUser(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null };
    },
  };
}

export function createOwnerPasswordRecoveryOperations(
  admin: SupabaseClient<Database>,
  auth: SupabaseClient<Database>
): OwnerPasswordRecoveryOperations {
  const identity = createOwnerAuthIdentityOperations(admin);
  return {
    async findProfilesByEmail(email) {
      const { data, error } = await admin
        .from('user_profiles')
        .select('id, organization_id, role, email, is_active')
        .ilike('email', escapePostgrestLikePattern(email));
      if (error) throw error;
      return data ?? [];
    },
    getAuthUser: identity.getAuthUser,
    async sendPasswordReset(email, redirectTo) {
      const { error } = await auth.auth.resetPasswordForEmail(email, { redirectTo });
      return !error;
    },
  };
}
