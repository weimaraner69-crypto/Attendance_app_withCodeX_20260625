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

function confirmationRequest(type = 'recovery', requestOrigin = appOrigin) {
  const form = new FormData();
  form.set('token_hash', 'token-hash');
  form.set('type', type);
  return new Request(`${requestOrigin}/auth/owner-confirm/complete`, {
    method: 'POST',
    headers: { Origin: appOrigin },
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
    expect(mocks.setIntentCookie).toHaveBeenCalledWith('opaque-token');
  });

  it('uses the configured public origin behind a Vercel deployment origin', async () => {
    const response = await POST(confirmationRequest('recovery', deploymentOrigin));

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
    expect(mocks.issueIntent).not.toHaveBeenCalled();
  });

  it('issues no cookie when the database intent fails', async () => {
    mocks.issueIntent.mockResolvedValue({ error: new Error('issue failed') });
    const response = await POST(confirmationRequest());
    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.setIntentCookie).not.toHaveBeenCalled();
  });

  it('rejects cross-origin confirmation posts before OTP verification', async () => {
    const form = new FormData();
    form.set('token_hash', 'token-hash');
    form.set('type', 'recovery');
    const response = await POST(new Request(`${appOrigin}/auth/owner-confirm/complete`, {
      method: 'POST',
      headers: { Origin: ['https:', '', 'foreign.example'].join('/') },
      body: form,
    }));
    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it('fails closed when the configured public origin is missing', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const response = await POST(confirmationRequest());

    expect(response.headers.get('location')).toBe(
      `${appOrigin}/auth/owner-password?invalid=1`
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.issueIntent).not.toHaveBeenCalled();
  });
});
