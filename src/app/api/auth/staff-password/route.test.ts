import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearIntent: vi.fn(),
  getIntent: vi.fn(),
  getRawAuthContext: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/auth/staff-password-intent', () => ({
  clearStaffPasswordIntent: mocks.clearIntent,
  getStaffPasswordIntent: mocks.getIntent,
}));
vi.mock('@/lib/auth/session', () => ({
  getRawAuthContext: mocks.getRawAuthContext,
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseServerClient: () => ({
    auth: { updateUser: mocks.updateUser, signOut: mocks.signOut },
  }),
}));

import { GET, POST } from './route';

const apiOrigin = ['https:', '', 'attendance.example'].join('/');
const staffContext = {
  user: { id: 'auth-user-1' },
  profile: { role: 'staff' },
  staff: { id: 'staff-1' },
};

describe('staff password update API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRawAuthContext.mockResolvedValue(staffContext);
    mocks.getIntent.mockReturnValue({ type: 'invite' });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('rejects an ordinary staff session without a verified email intent', async () => {
    mocks.getIntent.mockReturnValue(null);

    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: apiOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.clearIntent).not.toHaveBeenCalled();
  });

  it('updates the password and consumes the intent exactly after success', async () => {
    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: apiOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
    expect(mocks.clearIntent).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the intent available for a safe retry when Auth rejects the update', async () => {
    mocks.updateUser.mockResolvedValue({ error: new Error('rejected') });

    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: apiOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.clearIntent).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('rejects cross-origin password update requests', async () => {
    const foreignOrigin = ['https:', '', 'foreign.example'].join('/');
    const response = await POST(new Request(`${apiOrigin}/api/auth/staff-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: foreignOrigin },
      body: JSON.stringify({ password: 'new-password' }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('reports whether the callback-issued intent is still valid', async () => {
    await expect((await GET()).json()).resolves.toEqual({ authorized: true });
    mocks.getIntent.mockReturnValue(null);
    const unauthorized = await GET();
    expect(unauthorized.status).toBe(401);
  });
});
