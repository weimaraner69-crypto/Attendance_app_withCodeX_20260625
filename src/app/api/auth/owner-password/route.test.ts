import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearIntent: vi.fn(),
  getIntentToken: vi.fn(),
  validateIntent: vi.fn(),
  updateWithIntent: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/owner-password-intent', () => ({
  clearOwnerPasswordIntent: mocks.clearIntent,
  getOwnerPasswordIntentToken: mocks.getIntentToken,
}));
vi.mock('@/lib/auth/owner-password-update', () => ({
  classifyOwnerAuthUpdateError: vi.fn(() => 'unknown'),
  validateOwnerPasswordIntent: mocks.validateIntent,
  updateOwnerPasswordWithIntent: mocks.updateWithIntent,
}));
vi.mock('@/lib/auth/owner-auth-identity', () => ({
  hasValidOwnerAuthIdentityForUser: vi.fn(async () => true),
}));
vi.mock('@/lib/auth/owner-auth-operations', () => ({
  createOwnerAuthIdentityOperations: vi.fn(() => ({})),
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseAdminClient: mocks.createAdminClient,
}));

import { GET, POST } from './route';

const apiOrigin = ['https:', '', 'attendance.example'].join('/');
const deploymentOrigin = ['https:', '', 'attendance-deployment.example'].join('/');

describe('owner password update API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = apiOrigin;
    mocks.getIntentToken.mockReturnValue('opaque-token');
    mocks.validateIntent.mockResolvedValue({ id: 'intent-1', user_id: 'owner-user-1' });
    mocks.updateWithIntent.mockResolvedValue({ ok: true, code: 'updated' });
    mocks.createAdminClient.mockReturnValue({});
  });

  function updateRequest(origin = apiOrigin, requestOrigin = apiOrigin) {
    return new Request(`${requestOrigin}/api/auth/owner-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ password: 'new-password' }),
    });
  }

  it('rejects requests without a callback-issued owner intent', async () => {
    mocks.getIntentToken.mockReturnValue(null);
    const response = await POST(updateRequest());
    expect(response.status).toBe(401);
    expect(mocks.updateWithIntent).not.toHaveBeenCalled();
  });

  it('delegates the atomic update and clears the browser intent', async () => {
    const response = await POST(updateRequest());
    expect(response.status).toBe(200);
    expect(mocks.updateWithIntent).toHaveBeenCalledWith(expect.objectContaining({
      token: 'opaque-token',
      password: 'new-password',
    }));
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
  });

  it('accepts the configured public origin behind a Vercel deployment origin', async () => {
    const response = await POST(updateRequest(apiOrigin, deploymentOrigin));

    expect(response.status).toBe(200);
    expect(mocks.updateWithIntent).toHaveBeenCalledOnce();
  });

  it('keeps the browser intent when Auth explicitly rejects a retryable update', async () => {
    mocks.updateWithIntent.mockResolvedValue({
      ok: false,
      code: 'update_failed_retryable',
    });

    const response = await POST(updateRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ updated: false, retryable: true });
    expect(mocks.clearIntent).not.toHaveBeenCalled();
  });

  it('keeps the browser intent when another request owns the database claim', async () => {
    mocks.updateWithIntent.mockResolvedValue({ ok: false, code: 'claim_busy' });

    const response = await POST(updateRequest());

    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ updated: false, retryable: true });
    expect(mocks.clearIntent).not.toHaveBeenCalled();
  });

  it('clears the browser intent after an unknown or compensated update outcome', async () => {
    mocks.updateWithIntent.mockResolvedValue({ ok: false, code: 'update_unknown' });

    const response = await POST(updateRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ updated: false, retryable: false });
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
  });

  it('clears the browser intent when the worker no longer owns the claim', async () => {
    mocks.updateWithIntent.mockResolvedValue({ ok: false, code: 'stale_claim' });

    const response = await POST(updateRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ updated: false, retryable: false });
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
  });

  it('rejects cross-origin updates before reading the intent', async () => {
    const response = await POST(updateRequest(['https:', '', 'foreign.example'].join('/')));
    expect(response.status).toBe(403);
    expect(mocks.getIntentToken).not.toHaveBeenCalled();
    expect(mocks.updateWithIntent).not.toHaveBeenCalled();
  });

  it('fails closed when the configured public origin is missing', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const response = await POST(updateRequest());

    expect(response.status).toBe(403);
    expect(mocks.getIntentToken).not.toHaveBeenCalled();
    expect(mocks.updateWithIntent).not.toHaveBeenCalled();
  });

  it('reports and clears an expired database intent', async () => {
    mocks.validateIntent.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
  });
});
