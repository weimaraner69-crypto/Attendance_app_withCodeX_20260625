import { describe, expect, it } from 'vitest';

import {
  authenticateExternalApiRequest,
  getExternalApiKeyRejection,
  hashExternalApiKey,
} from './auth';

const activeKey = {
  id: 'key-id',
  organization_id: 'organization-id',
  name: 'Daily report production',
  scopes: ['attendance:read'],
  is_active: true,
  expires_at: null,
};

describe('external API authentication', () => {
  it('hashes API keys with the documented SHA-256 representation', () => {
    expect(hashExternalApiKey('test')).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    );
  });

  it('rejects a missing API key with the canonical error envelope', async () => {
    const origin = ['https:', '', 'attendance.example'].join('/');
    const request = new Request(`${origin}/api/external/v1/health`);
    const result = await authenticateExternalApiRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toEqual({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'APIキーが指定されていません',
        },
      });
    }
  });

  it('rejects disabled, expired, and under-scoped keys at their boundaries', async () => {
    const disabled = getExternalApiKeyRejection(
      { ...activeKey, is_active: false },
      'attendance:read'
    );
    expect(disabled?.status).toBe(403);
    expect(await disabled?.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

    const now = Date.parse('2026-07-13T00:00:00.000Z');
    const expired = getExternalApiKeyRejection(
      { ...activeKey, expires_at: '2026-07-13T00:00:00.000Z' },
      'attendance:read',
      now
    );
    expect(expired?.status).toBe(401);
    expect(await expired?.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });

    const underScoped = getExternalApiKeyRejection(activeKey, 'attendance:write');
    expect(underScoped?.status).toBe(403);
    expect(await underScoped?.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

    expect(getExternalApiKeyRejection(activeKey, 'attendance:read', now)).toBeNull();
  });
});
