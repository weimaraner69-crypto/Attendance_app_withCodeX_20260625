import { describe, expect, it } from 'vitest';

import { hashExternalApiKey } from './auth';
import {
  externalApiKeyDeactivationSuccess,
  expiresAtFromJstDate,
  externalApiKeyIssueSuccess,
  prepareExternalApiKey,
  validateExternalApiKeyIssueInput,
} from './key-management';

const now = Date.parse('2026-07-23T00:00:00.000Z');

describe('external API key management helpers', () => {
  it('accepts only the documented read scope and converts a JST date to the end of day', () => {
    const result = validateExternalApiKeyIssueInput(
      {
        name: '日報連携',
        scopes: ['attendance:read'],
        expiresOnJst: '2026-07-30',
      },
      now
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: '日報連携',
        scopes: ['attendance:read'],
        expiresAt: '2026-07-30T14:59:59.999Z',
      },
    });
    expect(expiresAtFromJstDate('2026-02-29')).toBeNull();
  });

  it('rejects invalid names, scopes, and non-future expiry dates before any key is generated', () => {
    expect(
      validateExternalApiKeyIssueInput(
        { name: '', scopes: ['attendance:read'], expiresOnJst: '' },
        now
      )
    ).toMatchObject({ ok: false });
    expect(
      validateExternalApiKeyIssueInput(
        { name: '連携先', scopes: ['attendance:write'], expiresOnJst: '' },
        now
      )
    ).toMatchObject({ ok: false });
    expect(
      validateExternalApiKeyIssueInput(
        { name: '連携先', scopes: ['attendance:read'], expiresOnJst: '2026-07-22' },
        now
      )
    ).toMatchObject({ ok: false });
  });

  it('generates a raw key once and prepares only its SHA-256 hash for storage', () => {
    const prepared = prepareExternalApiKey(
      { name: '日報連携', scopes: ['attendance:read'], expiresAt: null },
      () => Buffer.alloc(32, 7)
    );

    expect(prepared.rawApiKey).toMatch(/^eak_/);
    expect(prepared.record.key_hash).toBe(hashExternalApiKey(prepared.rawApiKey));
    expect(prepared.record).not.toHaveProperty('rawApiKey');
  });

  it('returns a client-safe issue response without the storage hash', () => {
    const response = externalApiKeyIssueSuccess('eak_example');

    expect(response).toEqual({ status: 'success', apiKey: 'eak_example' });
    expect(response).not.toHaveProperty('key_hash');
    expect(response).not.toHaveProperty('keyHash');

    const deactivationResponse = externalApiKeyDeactivationSuccess('監査ログの記録に失敗しました。');
    expect(deactivationResponse).toEqual({
      status: 'success',
      warning: '監査ログの記録に失敗しました。',
    });
    expect(deactivationResponse).not.toHaveProperty('apiKey');
    expect(deactivationResponse).not.toHaveProperty('key_hash');
  });
});
