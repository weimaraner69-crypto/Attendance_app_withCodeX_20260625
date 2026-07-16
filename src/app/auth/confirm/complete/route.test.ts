import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  hasValidIdentity: vi.fn(),
  startGuard: vi.fn(),
  clearGuard: vi.fn(),
  generateToken: vi.fn(),
  hashToken: vi.fn(),
  setIntentCookie: vi.fn(),
  cleanupUpdate: vi.fn(),
  insertIntent: vi.fn(),
}));

vi.mock('@/lib/auth/staff-auth-identity', () => ({
  hasValidStaffAuthIdentity: mocks.hasValidIdentity,
}));
vi.mock('@/lib/auth/staff-password-intent', () => ({
  clearStaffPasswordFlowGuard: mocks.clearGuard,
  generateStaffPasswordIntentToken: mocks.generateToken,
  hashStaffPasswordIntentToken: mocks.hashToken,
  setStaffPasswordIntentCookie: mocks.setIntentCookie,
  STAFF_PASSWORD_INTENT_TTL_SECONDS: 600,
  startStaffPasswordFlowGuard: mocks.startGuard,
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseServerClient: () => ({
    auth: { verifyOtp: mocks.verifyOtp, signOut: mocks.signOut },
  }),
  createSupabaseAdminClient: () => ({
    auth: { admin: {} },
    from: () => ({
      update: () => ({
        eq: () => ({ is: mocks.cleanupUpdate }),
      }),
      insert: mocks.insertIntent,
    }),
  }),
}));

import { POST } from './route';

const appOrigin = ['https:', '', 'attendance.example'].join('/');

function confirmationRequest(type = 'invite') {
  const form = new FormData();
  form.set('token_hash', 'token-hash');
  form.set('type', type);
  return new Request(`${appOrigin}/auth/confirm/complete`, {
    method: 'POST',
    headers: { Origin: appOrigin },
    body: form,
  });
}

describe('staff Auth confirmation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.hasValidIdentity.mockResolvedValue(true);
    mocks.generateToken.mockReturnValue('opaque-token');
    mocks.hashToken.mockReturnValue('a'.repeat(64));
    mocks.cleanupUpdate.mockResolvedValue({ error: null });
    mocks.insertIntent.mockResolvedValue({ error: null });
  });

  it('removes the OTP session before issuing a DB-backed browser intent', async () => {
    const response = await POST(confirmationRequest());

    expect(response.status).toBe(307);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'invite' });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.insertIntent).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'auth-user-1',
      token_hash: 'a'.repeat(64),
      intent_type: 'invite',
      consumed_at: null,
    }));
    expect(mocks.setIntentCookie).toHaveBeenCalledWith('opaque-token');
    expect(mocks.clearGuard).toHaveBeenCalledOnce();
  });

  it('keeps the authorization guard and issues no intent when logout fails', async () => {
    mocks.signOut.mockResolvedValue({ error: new Error('logout failed') });

    const response = await POST(confirmationRequest('recovery'));

    expect(response.status).toBe(307);
    expect(mocks.startGuard).toHaveBeenCalledOnce();
    expect(mocks.clearGuard).not.toHaveBeenCalled();
    expect(mocks.insertIntent).not.toHaveBeenCalled();
    expect(mocks.setIntentCookie).not.toHaveBeenCalled();
  });

  it('rejects cross-origin confirmation posts before OTP verification', async () => {
    const form = new FormData();
    form.set('token_hash', 'token-hash');
    form.set('type', 'invite');
    const response = await POST(new Request(`${appOrigin}/auth/confirm/complete`, {
      method: 'POST',
      headers: { Origin: ['https:', '', 'foreign.example'].join('/') },
      body: form,
    }));

    expect(response.status).toBe(307);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
