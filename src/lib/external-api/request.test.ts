import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateExternalApiRequestMock } = vi.hoisted(() => ({
  authenticateExternalApiRequestMock: vi.fn(),
}));

vi.mock('./auth', () => ({
  authenticateExternalApiRequest: authenticateExternalApiRequestMock,
}));

import { withExternalApiRequest } from './request';

const apiOrigin = ['https:', '', 'attendance.example'].join('/');
const resetAt = '2026-07-16T06:01:00.000Z';

function authenticatedSupabase(
  rateLimit = { allowed: true, remaining: 59, reset_at: resetAt }
) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: [rateLimit], error: null }),
    from: vi.fn(() => ({ insert })),
  };

  authenticateExternalApiRequestMock.mockResolvedValue({
    ok: true,
    context: {
      supabase,
      organization: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Contract Test Organization',
        timezone: 'Asia/Tokyo',
      },
      apiKey: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Daily report production',
        scopes: ['attendance:read'],
      },
    },
  });

  return { supabase, insert };
}

describe('external API request guard', () => {
  beforeEach(() => {
    authenticateExternalApiRequestMock.mockReset();
  });

  it('adds rate-limit headers and records successful requests', async () => {
    const { supabase, insert } = authenticatedSupabase();
    const request = new Request(`${apiOrigin}/api/external/v1/health?ignored=true`);

    const response = await withExternalApiRequest(
      request,
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
    expect(response.headers.get('X-RateLimit-Reset')).toBe(
      String(Date.parse(resetAt) / 1000)
    );
    expect(supabase.rpc).toHaveBeenCalledWith('consume_external_api_rate_limit', {
      p_key_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(insert).toHaveBeenCalledWith({
      key_id: '22222222-2222-4222-8222-222222222222',
      endpoint: '/api/external/v1/health',
      status_code: 200,
    });
  });

  it('preserves headers and access logs for handler error responses', async () => {
    const { insert } = authenticatedSupabase({
      allowed: true,
      remaining: 41,
      reset_at: resetAt,
    });

    const response = await withExternalApiRequest(
      new Request(`${apiOrigin}/api/external/v1/attendance`),
      async () => new Response('invalid', { status: 400 })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('41');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/external/v1/attendance',
        status_code: 400,
      })
    );
  });

  it('returns the canonical 429 response without invoking the handler', async () => {
    const { insert } = authenticatedSupabase({
      allowed: false,
      remaining: 0,
      reset_at: resetAt,
    });
    const handler = vi.fn();

    const response = await withExternalApiRequest(
      new Request(`${apiOrigin}/api/external/v1/staff`),
      handler
    );

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(await response.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'レート制限を超過しました',
      },
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: 429 })
    );
  });

  it('fails closed with rate-limit headers when the counter is unavailable', async () => {
    const { supabase, insert } = authenticatedSupabase();
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    const handler = vi.fn();

    const response = await withExternalApiRequest(
      new Request(`${apiOrigin}/api/external/v1/stores`),
      handler
    );

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: 500 })
    );
  });

  it('does not replace the API response when access logging throws', async () => {
    const { insert } = authenticatedSupabase();
    insert.mockRejectedValueOnce(new Error('logging unavailable'));

    const response = await withExternalApiRequest(
      new Request(`${apiOrigin}/api/external/v1/health`),
      async () => new Response('ok', { status: 200 })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('does not replace the API response when access logging returns an error', async () => {
    const { insert } = authenticatedSupabase();
    insert.mockResolvedValueOnce({ error: { message: 'logging unavailable' } });

    const response = await withExternalApiRequest(
      new Request(`${apiOrigin}/api/external/v1/health`),
      async () => new Response('ok', { status: 200 })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('adds fail-closed headers to authentication failures', async () => {
    const authResponse = new Response('unauthorized', { status: 401 });
    authenticateExternalApiRequestMock.mockResolvedValue({
      ok: false,
      response: authResponse,
    });
    const handler = vi.fn();

    const response = await withExternalApiRequest(
      new Request(`${apiOrigin}/api/external/v1/health`),
      handler
    );

    expect(response).toBe(authResponse);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(Number(response.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns a controlled 500 with headers when authentication throws', async () => {
    authenticateExternalApiRequestMock.mockRejectedValueOnce(
      new Error('authentication unavailable')
    );
    const handler = vi.fn();

    const response = await withExternalApiRequest(
      new Request(`${apiOrigin}/api/external/v1/health`),
      handler
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(Number(response.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0);
    expect(handler).not.toHaveBeenCalled();
  });
});
