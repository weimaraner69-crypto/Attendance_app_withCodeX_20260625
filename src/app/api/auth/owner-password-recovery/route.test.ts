import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildUrl: vi.fn(),
  requestRecovery: vi.fn(),
  createOperations: vi.fn(),
  createAdminClient: vi.fn(),
  createAuthClient: vi.fn(),
}));

vi.mock('@/lib/auth/owner-password-recovery', () => ({
  buildOwnerPasswordRecoveryUrl: mocks.buildUrl,
  requestOwnerPasswordRecovery: mocks.requestRecovery,
}));
vi.mock('@/lib/auth/owner-auth-operations', () => ({
  createOwnerPasswordRecoveryOperations: mocks.createOperations,
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseAdminClient: mocks.createAdminClient,
  createSupabaseTransientAuthClient: mocks.createAuthClient,
}));

import { POST } from './route';

const appOrigin = ['https:', '', 'attendance.example'].join('/');

function request(email: unknown, origin = appOrigin) {
  return new Request(`${appOrigin}/api/auth/owner-password-recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email }),
  });
}

describe('owner password recovery request API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildUrl.mockReturnValue(`${appOrigin}/auth/owner-confirm`);
    mocks.createAdminClient.mockReturnValue({ kind: 'admin' });
    mocks.createAuthClient.mockReturnValue({ kind: 'auth' });
    mocks.createOperations.mockReturnValue({ kind: 'operations' });
    mocks.requestRecovery.mockResolvedValue({ accepted: true });
  });

  it('uses the same 202 response after delegating a valid-looking request', async () => {
    const response = await POST(request('owner@example.com'));
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      message: '該当するオーナーアカウントがある場合、再設定メールを送信しました。',
    });
    expect(response.status).toBe(202);
    expect(mocks.requestRecovery).toHaveBeenCalledWith({
      email: 'owner@example.com',
      redirectTo: `${appOrigin}/auth/owner-confirm`,
      operations: { kind: 'operations' },
    });
  });

  it('returns the same public response for an invalid body', async () => {
    const response = await POST(request(123));
    expect(response.status).toBe(202);
    expect(mocks.requestRecovery).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
  });

  it('returns the same response without sending for cross-origin requests', async () => {
    const response = await POST(request('owner@example.com', ['https:', '', 'foreign.example'].join('/')));
    expect(response.status).toBe(202);
    expect(mocks.requestRecovery).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('fails closed without exposing an invalid application URL', async () => {
    mocks.buildUrl.mockReturnValue(null);
    const response = await POST(request('owner@example.com'));
    expect(response.status).toBe(202);
    expect(mocks.requestRecovery).not.toHaveBeenCalled();
  });

  it('keeps the same response when infrastructure setup throws', async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error('configuration unavailable');
    });
    const response = await POST(request('owner@example.com'));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      message: '該当するオーナーアカウントがある場合、再設定メールを送信しました。',
    });
  });

  it('does not send when the Origin header is absent', async () => {
    const response = await POST(new Request(
      `${appOrigin}/api/auth/owner-password-recovery`,
      { method: 'POST', body: JSON.stringify({ email: 'owner@example.com' }) }
    ));
    expect(response.status).toBe(202);
    expect(mocks.requestRecovery).not.toHaveBeenCalled();
  });
});
