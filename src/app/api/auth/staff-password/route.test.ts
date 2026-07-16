import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearIntent: vi.fn(),
  getIntentToken: vi.fn(),
  validateIntent: vi.fn(),
  updateWithIntent: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/staff-password-intent', () => ({
  clearStaffPasswordIntent: mocks.clearIntent,
  getStaffPasswordIntentToken: mocks.getIntentToken,
}));
vi.mock('@/lib/auth/staff-password-update', () => ({
  validateStaffPasswordIntent: mocks.validateIntent,
  updateStaffPasswordWithIntent: mocks.updateWithIntent,
}));
vi.mock('@/lib/auth/staff-auth-identity', () => ({
  hasValidStaffAuthIdentity: vi.fn(async () => true),
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseAdminClient: mocks.createAdminClient,
}));

import { GET, POST } from './route';

const apiOrigin = ['https:', '', 'attendance.example'].join('/');

describe('staff password update API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIntentToken.mockReturnValue('opaque-token');
    mocks.validateIntent.mockResolvedValue({ id: 'intent-1', user_id: 'auth-user-1' });
    mocks.updateWithIntent.mockResolvedValue({ ok: true, code: 'updated' });
    mocks.createAdminClient.mockReturnValue({});
  });

  it('rejects an ordinary request without a callback-issued intent cookie', async () => {
    mocks.getIntentToken.mockReturnValue(null);
    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: apiOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(401);
    expect(mocks.updateWithIntent).not.toHaveBeenCalled();
  });

  it('delegates to the atomic DB-backed update and consumes the browser token', async () => {
    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: apiOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateWithIntent).toHaveBeenCalledWith(expect.objectContaining({
      token: 'opaque-token',
      password: 'new-password',
    }));
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
  });

  it('clears a consumed token when the Admin password update fails', async () => {
    mocks.updateWithIntent.mockResolvedValue({ ok: false, code: 'update_failed' });
    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: apiOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
  });

  it('rejects cross-origin password update requests', async () => {
    const foreignOrigin = ['https:', '', 'foreign.example'].join('/');
    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: foreignOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.updateWithIntent).not.toHaveBeenCalled();
  });

  it('reports and clears an invalid or expired DB intent', async () => {
    mocks.validateIntent.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
  });
});
