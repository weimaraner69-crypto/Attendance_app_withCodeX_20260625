import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthenticatedRole: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedRole: mocks.requireAuthenticatedRole,
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));
vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  deactivateExternalApiKeyAction,
  issueExternalApiKeyAction,
} from './actions';

const authContext = {
  user: { id: 'owner-user-1' },
  profile: { organization_id: 'organization-1', role: 'owner' },
};

const issuedKey = {
  id: 'key-1',
  name: '日報連携',
  scopes: ['attendance:read'],
  expires_at: null,
  is_active: true,
};

function issueForm() {
  const form = new FormData();
  form.set('name', '日報連携');
  form.append('scopes', 'attendance:read');
  return form;
}

function deactivationForm() {
  const form = new FormData();
  form.set('key_id', 'key-1');
  return form;
}

describe('external API key management actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedRole.mockResolvedValue(authContext);
  });

  it('enforces owner authorization before accessing the service-role client', async () => {
    mocks.requireAuthenticatedRole.mockRejectedValue(new Error('not authorized'));

    await expect(issueExternalApiKeyAction(issueForm())).rejects.toThrow('not authorized');

    expect(mocks.requireAuthenticatedRole).toHaveBeenCalledWith(['owner']);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('issues a key without selecting or auditing its hash or plaintext, and keeps an audit failure non-blocking', async () => {
    const keyQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: issuedKey, error: null }),
    };
    keyQuery.insert.mockReturnValue(keyQuery);
    keyQuery.select.mockReturnValue(keyQuery);
    const auditInsert = vi.fn().mockResolvedValue({ error: new Error('audit unavailable') });

    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'external_api_keys') return keyQuery;
        return { insert: auditInsert };
      }),
    });

    const result = await issueExternalApiKeyAction(issueForm());

    expect(result).toMatchObject({ status: 'success', warning: expect.any(String) });
    expect(keyQuery.select).toHaveBeenCalledWith('id, name, scopes, expires_at, is_active');
    expect(keyQuery.select.mock.calls[0][0]).not.toContain('key_hash');
    expect(keyQuery.insert.mock.calls[0][0]).toMatchObject({
      organization_id: 'organization-1',
      is_active: true,
    });
    expect(keyQuery.insert.mock.calls[0][0]).toHaveProperty('key_hash');

    const auditEntry = auditInsert.mock.calls[0][0];
    expect(auditEntry).toMatchObject({
      organization_id: 'organization-1',
      actor_user_id: 'owner-user-1',
      action: 'external_api_key.issued',
      target_id: 'key-1',
    });
    expect(auditEntry.metadata).not.toHaveProperty('key_hash');
    expect(JSON.stringify(auditEntry.metadata)).not.toContain('eak_');
  });

  it('uses both key ID and organization ID for an active-key deactivation', async () => {
    const existingKeyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: issuedKey, error: null }),
    };
    existingKeyQuery.select.mockReturnValue(existingKeyQuery);
    existingKeyQuery.eq.mockReturnValue(existingKeyQuery);

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { ...issuedKey, is_active: false }, error: null }),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);

    const apiKeyTable = {
      select: existingKeyQuery.select,
      update: updateQuery.update,
    };
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === 'external_api_keys' ? apiKeyTable : { insert: auditInsert }
      ),
    });

    const result = await deactivateExternalApiKeyAction(deactivationForm());

    expect(result).toEqual({ status: 'success' });
    expect(existingKeyQuery.eq).toHaveBeenCalledWith('id', 'key-1');
    expect(existingKeyQuery.eq).toHaveBeenCalledWith('organization_id', 'organization-1');
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'key-1');
    expect(updateQuery.eq).toHaveBeenCalledWith('organization_id', 'organization-1');
    expect(updateQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(updateQuery.select).toHaveBeenCalledWith('id, name, scopes, expires_at, is_active');
    expect(auditInsert.mock.calls[0][0].metadata).not.toHaveProperty('key_hash');
    expect(JSON.stringify(auditInsert.mock.calls[0][0].metadata)).not.toContain('eak_');
  });
});
