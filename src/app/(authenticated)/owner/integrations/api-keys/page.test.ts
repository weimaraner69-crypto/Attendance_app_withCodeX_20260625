import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OwnerExternalApiKeysPage from './page';

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  refresh: vi.fn(),
  requireAuthenticatedRole: vi.fn(),
}));

Object.assign(globalThis, { React });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/app/(authenticated)/owner/integrations/api-keys/actions', () => ({
  deactivateExternalApiKeyAction: vi.fn(),
  issueExternalApiKeyAction: vi.fn(),
}));
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedRole: mocks.requireAuthenticatedRole,
}));
vi.mock('@/lib/supabase', () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

const authContext = {
  user: { id: 'owner-user-1' },
  profile: { organization_id: 'organization-1', role: 'owner' },
};

const apiKey = {
  id: 'key-1',
  name: '日報連携',
  scopes: ['attendance:read'],
  is_active: true,
  last_used_at: null,
  created_at: '2026-07-23T00:00:00.000Z',
  expires_at: null,
};

function configurePageQuery(result: { data: typeof apiKey[] | null; error: Error | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  mocks.createSupabaseAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue(query),
  });
  return query;
}

async function renderPage() {
  return renderToStaticMarkup(await OwnerExternalApiKeysPage());
}

describe('OwnerExternalApiKeysPage SSR smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedRole.mockResolvedValue(authContext);
  });

  it('renders the owner-only issue form and management table with the required fields', async () => {
    const query = configurePageQuery({ data: [apiKey], error: null });

    const html = await renderPage();

    expect(mocks.requireAuthenticatedRole).toHaveBeenCalledWith(['owner']);
    expect(query.select).toHaveBeenCalledWith(
      'id, name, scopes, is_active, last_used_at, created_at, expires_at'
    );
    expect(query.select.mock.calls[0][0]).not.toContain('key_hash');
    expect(query.eq).toHaveBeenCalledWith('organization_id', 'organization-1');
    expect(html).toContain('APIキーを発行');
    expect(html).toContain('id="api-key-name"');
    expect(html).toContain('name="scopes"');
    expect(html).toContain('name="expires_on_jst"');
    expect(html).toContain('名前');
    expect(html).toContain('スコープ');
    expect(html).toContain('状態');
    expect(html).toContain('最終利用');
    expect(html).toContain('作成日時');
    expect(html).toContain('有効期限');
    expect(html).toContain('無効化');
    expect(html).toContain('キーの値は発行後、この画面で一度だけ表示されます。');
  });

  it('renders an error instead of the manager when key retrieval fails', async () => {
    configurePageQuery({ data: null, error: new Error('dummy query failure') });

    const html = await renderPage();

    expect(html).toContain('role="alert"');
    expect(html).toContain('発行済みAPIキーの取得に失敗しました。');
    expect(html).not.toContain('APIキーを発行');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<table');
  });
});
