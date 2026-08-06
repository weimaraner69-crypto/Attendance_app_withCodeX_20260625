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

describe('owner password update API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIntentToken.mockReturnValue('opaque-token');
    mocks.validateIntent.mockResolvedValue({ id: 'intent-1', user_id: 'owner-user-1' });
    mocks.updateWithIntent.mockResolvedValue({ ok: true, code: 'updated' });
    mocks.createAdminClient.mockReturnValue({});
  });

  function updateRequest(origin = apiOrigin) {
    return new Request(`${apiOrigin}/api/auth/owner-password`, {
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

  it('rejects cross-origin updates before reading the intent', async () => {
    const response = await POST(updateRequest(['https:', '', 'foreign.example'].join('/')));
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
