import { redirect } from 'next/navigation';

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { isAppUnlocked } from '@/lib/auth/device-session';

export type AppRole = Database['public']['Enums']['app_role'];

export type CurrentAuthContext = {
  user: {
    id: string;
    email: string | null;
    last_sign_in_at: string | null;
  };
  profile: {
    id: string;
    organization_id: string;
    role: AppRole;
    display_name: string;
    email: string;
    is_active: boolean;
  };
  managerStore: {
    id: string;
    name: string;
  } | null;
  staff: {
    id: string;
    default_store_id: string | null;
  } | null;
};

type ManagerPermissionRow = {
  store_id: string;
  stores: {
    id: string;
    name: string;
  } | null;
};

export function getRoleHomePath(role: AppRole, managerStoreId?: string | null) {
  if (role === 'owner') return '/owner';
  if (role === 'sr') return '/sr';
  if (role === 'manager') return managerStoreId ? `/manager/${managerStoreId}` : '/manager/login';
  return '/stamp';
}

export async function getRawAuthContext(): Promise<CurrentAuthContext | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, organization_id, role, display_name, email, is_active')
    .eq('id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (profileError || !profile) return null;

  let managerStore: CurrentAuthContext['managerStore'] = null;
  if (profile.role === 'manager') {
    const { data: permission } = await admin
      .from('manager_store_permissions')
      .select('store_id, stores:store_id (id, name)')
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id)
      .limit(1)
      .maybeSingle<ManagerPermissionRow>();

    managerStore = permission?.stores
      ? {
          id: permission.stores.id,
          name: permission.stores.name,
        }
      : null;
  }

  let staff: CurrentAuthContext['staff'] = null;
  if (profile.role === 'staff') {
    const { data: staffRow } = await admin
      .from('staff')
      .select('id, default_store_id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    staff = staffRow
      ? {
          id: staffRow.id,
          default_store_id: staffRow.default_store_id,
        }
      : null;
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    profile,
    managerStore,
    staff,
  };
}

export async function getCurrentAuthContext(): Promise<CurrentAuthContext | null> {
  const context = await getRawAuthContext();
  if (!context) return null;
  if (context.profile.role !== 'staff' && !isAppUnlocked(context.user.id)) return null;
  return context;
}

export async function requireAuthenticatedRole(allowedRoles: AppRole[]) {
  const context = await getCurrentAuthContext();
  if (!context) redirect('/login');

  if (!allowedRoles.includes(context.profile.role)) {
    redirect(getRoleHomePath(context.profile.role, context.managerStore?.id));
  }

  return context;
}

export async function requireManagerStore(storeId: string) {
  const context = await requireAuthenticatedRole(['manager']);
  const admin = createSupabaseAdminClient();

  const { data: permission } = await admin
    .from('manager_store_permissions')
    .select('store_id')
    .eq('user_id', context.user.id)
    .eq('store_id', storeId)
    .eq('organization_id', context.profile.organization_id)
    .maybeSingle();

  if (!permission) {
    redirect(getRoleHomePath(context.profile.role, context.managerStore?.id));
  }

  return context;
}
