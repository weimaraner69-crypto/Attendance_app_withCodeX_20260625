import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('./env', () => ({
  getSupabaseUrl: () => 'supabase-url',
  getSupabaseAnonKey: () => 'anon-key',
}));

import { createSupabaseTransientAuthClient } from './transient-auth';

describe('transient Supabase Auth client', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never persists an OTP session to browser or server storage', () => {
    createSupabaseTransientAuthClient();

    expect(mocks.createClient).toHaveBeenCalledWith('supabase-url', 'anon-key', {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });
});
