import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  hasPasswordFlow: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createSupabaseServerClient: mocks.createServerClient,
  createSupabaseAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/auth/device-session', () => ({
  isAppUnlocked: vi.fn(() => true),
}));
vi.mock('@/lib/auth/staff-password-intent', () => ({
  hasStaffPasswordFlowCookie: mocks.hasPasswordFlow,
}));

import { getCurrentAuthContext, getRawAuthContext } from './session';

function query(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'limit']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

describe('staff session organization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPasswordFlow.mockReturnValue(false);
    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-user-1', email: 'staff@example.com' } },
        }),
      },
    });
  });

  it('requires the linked staff row to match the profile organization', async () => {
    const profileQuery = query({
      data: {
        id: 'auth-user-1',
        organization_id: 'organization-1',
        role: 'staff',
        display_name: 'Staff',
        email: 'staff@example.com',
        is_active: true,
      },
      error: null,
    });
    const staffQuery = query({
      data: { id: 'staff-1', default_store_id: null },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === 'user_profiles' ? profileQuery : staffQuery),
    });

    const context = await getRawAuthContext();

    expect(staffQuery.eq).toHaveBeenCalledWith('auth_user_id', 'auth-user-1');
    expect(staffQuery.eq).toHaveBeenCalledWith('organization_id', 'organization-1');
    expect(context?.staff?.id).toBe('staff-1');
  });

  it('does not create a staff context when the organization-scoped lookup has no row', async () => {
    const profileQuery = query({
      data: {
        id: 'auth-user-1',
        organization_id: 'organization-1',
        role: 'staff',
        display_name: 'Staff',
        email: 'staff@example.com',
        is_active: true,
      },
      error: null,
    });
    const staffQuery = query({ data: null, error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === 'user_profiles' ? profileQuery : staffQuery),
    });

    expect((await getRawAuthContext())?.staff).toBeNull();
  });

  it('blocks ordinary application authorization while a callback flow cookie exists', async () => {
    mocks.hasPasswordFlow.mockReturnValue(true);
    await expect(getCurrentAuthContext()).resolves.toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});
