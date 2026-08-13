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

vi.mock('@/lib/auth/owner-auth-operations', () => ({
  createOwnerAuthIdentityOperations: () => ({ kind: 'identity' }),
}));
vi.mock('@/lib/auth/owner-auth-identity', () => ({
  hasValidOwnerAuthIdentityForUser: mocks.hasValidIdentity,
}));
vi.mock('@/lib/auth/owner-password-intent', () => ({
  clearOwnerPasswordIntent: mocks.clearIntentCookie,
  generateOwnerPasswordIntentToken: mocks.generateToken,
  hashOwnerPasswordIntentToken: mocks.hashToken,
  setOwnerPasswordIntentCookie: mocks.setIntentCookie,
  OWNER_PASSWORD_INTENT_TTL_SECONDS: 600,
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseTransientAuthClient: () => ({ auth: { verifyOtp: mocks.verifyOtp } }),
  createSupabaseAdminClient: () => ({ rpc: mocks.issueIntent }),
}));

import { POST } from './route';

const appOrigin = ['https:', '', 'attendance.example'].join('/');
const deploymentOrigin = ['https:', '', 'attendance-deployment.example'].join('/');

function confirmationRequest(
  type = 'recovery',
  requestOrigin = appOrigin,
  headers: HeadersInit = { Origin: appOrigin }
) {
  const form = new FormData();
  form.set('token_hash', 'token-hash');
  form.set('type', type);
  return new Request(`${requestOrigin}/auth/owner-confirm/complete`, {
    method: 'POST',
    headers,
    body: form,
  });
}

describe('owner Auth confirmation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = appOrigin;
    mocks.verifyOtp.mockResolvedValue({ data: { user: { id: 'owner-user-1' } }, error: null });
    mocks.hasValidIdentity.mockResolvedValue(true);
    mocks.generateToken.mockReturnValue('opaque-token');
    mocks.hashToken.mockReturnValue('a'.repeat(64));
    mocks.issueIntent.mockResolvedValue({ error: null });
  });

  it('verifies recovery OTP and issues an owner-only DB intent', async () => {
    const response = await POST(confirmationRequest());
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${appOrigin}/auth/owner-password`);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'recovery' });
    expect(mocks.hasValidIdentity).toHaveBeenCalledWith(
      'owner-user-1',
      { kind: 'identity' }
    );
    expect(mocks.issueIntent).toHaveBeenCalledWith('issue_owner_password_recovery_intent', {
      p_user_id: 'owner-user-1',
      p_token_hash: 'a'.repeat(64),
      p_expires_at: expect.any(String),
    });
    expect(mocks.clearIntentCookie).toHaveBeenCalledOnce();
    expect(mocks.clearIntentCookie.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.issueIntent.mock.invocationCallOrder[0]
    );
    expect(mocks.setIntentCookie).toHaveBeenCalledWith('opaque-token');
  });

  it('uses the configured public origin behind a Vercel deployment origin', async () => {
    const response = await POST(confirmationRequest('recovery', deploymentOrigin));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${appOrigin}/auth/owner-password`);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'recovery' });
  });

  it('rejects an explicitly cross-site confirmation before OTP verification', async () => {
    const response = await POST(confirmationRequest(
      'recovery',
      deploymentOrigin,
      { 'Sec-Fetch-Site': 'cross-site' }
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.clearIntentCookie).not.toHaveBeenCalled();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
  });

  it.each(['same-origin', 'same-site', 'none'])(
    'allows a %s confirmation to reach OTP verification',
    async (fetchSite) => {
      const response = await POST(confirmationRequest(
        'recovery',
        deploymentOrigin,
        { 'Sec-Fetch-Site': fetchSite }
      ));

      expect(response.headers.get('location')).toBe(`${appOrigin}/auth/owner-password`);
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'token-hash',
        type: 'recovery',
      });
    }
  );

  it('does not depend on browser navigation headers to verify the one-time token', async () => {
    const response = await POST(confirmationRequest(
      'recovery',
      deploymentOrigin,
      {}
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${appOrigin}/auth/owner-password`);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'recovery' });
  });

  it('rejects other OTP types before verification', async () => {
    const response = await POST(confirmationRequest('invite'));
    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.clearIntentCookie).not.toHaveBeenCalled();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
  });

  it('issues no cookie when the database intent fails', async () => {
    mocks.issueIntent.mockResolvedValue({ error: new Error('issue failed') });
    const response = await POST(confirmationRequest());
    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.clearIntentCookie).toHaveBeenCalledOnce();
    expect(mocks.setIntentCookie).not.toHaveBeenCalled();
  });

  it('issues no intent when Supabase rejects the one-time token', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid token'),
    });
    const response = await POST(confirmationRequest('recovery', deploymentOrigin, {}));

    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'recovery' });
    expect(mocks.hasValidIdentity).not.toHaveBeenCalled();
    expect(mocks.clearIntentCookie).not.toHaveBeenCalled();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
  });

  it('preserves an existing intent when the verified user is not an active owner', async () => {
    mocks.hasValidIdentity.mockResolvedValue(false);

    const response = await POST(confirmationRequest());

    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.verifyOtp).toHaveBeenCalledOnce();
    expect(mocks.hasValidIdentity).toHaveBeenCalledOnce();
    expect(mocks.clearIntentCookie).not.toHaveBeenCalled();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
  });

  it('fails closed when the configured public origin is missing', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const response = await POST(confirmationRequest());

    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.clearIntentCookie).not.toHaveBeenCalled();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
  });
});
