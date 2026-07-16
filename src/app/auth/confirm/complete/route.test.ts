import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  hasValidIdentity: vi.fn(),
  generateToken: vi.fn(),
  hashToken: vi.fn(),
  clearIntentCookie: vi.fn(),
  setIntentCookie: vi.fn(),
  issueIntent: vi.fn(),
}));

vi.mock('@/lib/auth/staff-auth-identity', () => ({
  hasValidStaffAuthIdentity: mocks.hasValidIdentity,
}));
vi.mock('@/lib/auth/staff-password-intent', () => ({
  clearStaffPasswordIntent: mocks.clearIntentCookie,
  generateStaffPasswordIntentToken: mocks.generateToken,
  hashStaffPasswordIntentToken: mocks.hashToken,
  setStaffPasswordIntentCookie: mocks.setIntentCookie,
  STAFF_PASSWORD_INTENT_TTL_SECONDS: 600,
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseTransientAuthClient: () => ({
    auth: { verifyOtp: mocks.verifyOtp },
  }),
  createSupabaseAdminClient: () => ({
    auth: { admin: {} },
    rpc: mocks.issueIntent,
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
    mocks.hasValidIdentity.mockResolvedValue(true);
    mocks.generateToken.mockReturnValue('opaque-token');
    mocks.hashToken.mockReturnValue('a'.repeat(64));
    mocks.issueIntent.mockResolvedValue({ error: null });
  });

  it('uses transient OTP verification and atomically issues a DB-backed browser intent', async () => {
    const response = await POST(confirmationRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${appOrigin}/auth/staff-password`);
    expect(mocks.clearIntentCookie).toHaveBeenCalledOnce();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'invite' });
    expect(mocks.issueIntent).toHaveBeenCalledWith('issue_staff_password_intent', {
      p_user_id: 'auth-user-1',
      p_token_hash: 'a'.repeat(64),
      p_intent_type: 'invite',
      p_expires_at: expect.any(String),
    });
    expect(mocks.setIntentCookie).toHaveBeenCalledWith('opaque-token');
  });

  it('issues no browser intent when the atomic database operation fails', async () => {
    mocks.issueIntent.mockResolvedValue({ error: new Error('issue failed') });

    const response = await POST(confirmationRequest('recovery'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/staff-password?invalid=1`
    );
    expect(mocks.clearIntentCookie).toHaveBeenCalledOnce();
    expect(mocks.setIntentCookie).not.toHaveBeenCalled();
  });

  it('clears an old intent when OTP verification fails', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null }, error: new Error('invalid OTP') });

    const response = await POST(confirmationRequest());

    expect(response.status).toBe(303);
    expect(mocks.clearIntentCookie).toHaveBeenCalledOnce();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
    expect(mocks.setIntentCookie).not.toHaveBeenCalled();
  });

  it('clears an old intent when the staff identity is invalid', async () => {
    mocks.hasValidIdentity.mockResolvedValue(false);

    const response = await POST(confirmationRequest());

    expect(response.status).toBe(303);
    expect(mocks.clearIntentCookie).toHaveBeenCalledOnce();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
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

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/staff-password?invalid=1`
    );
    expect(mocks.clearIntentCookie).toHaveBeenCalledOnce();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
