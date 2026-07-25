import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OwnerAuditLogsPage from './page';

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  requireAuthenticatedRole: vi.fn(),
}));

Object.assign(globalThis, { React });

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

const apiKeyAuditLog = {
  id: 'log-1',
  actor_user_id: 'owner-user-1',
  action: 'external_api_key.issued',
  target_table: 'external_api_keys',
  target_id: 'key-1',
  metadata: {
    name: '日報アプリ本番',
    scopes: ['attendance:read'],
    expires_at: null,
    is_active: true,
  },
  created_at: '2026-07-25T00:00:00.000Z',
};

function configureAuditQueries() {
  const auditQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  auditQuery.select.mockReturnValue(auditQuery);
  auditQuery.eq.mockReturnValue(auditQuery);
  auditQuery.gte.mockReturnValue(auditQuery);
  auditQuery.lte.mockReturnValue(auditQuery);
  auditQuery.order.mockReturnValue(auditQuery);
  auditQuery.limit.mockResolvedValue({ data: [apiKeyAuditLog] });

  const actorsQuery = {
    select: vi.fn(),
    in: vi.fn(),
  };
  actorsQuery.select.mockReturnValue(actorsQuery);
  actorsQuery.in.mockResolvedValue({
    data: [{ id: 'owner-user-1', display_name: '樫尾オーナー', email: 'owner@example.com' }],
  });

  mocks.createSupabaseAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'audit_logs') return auditQuery;
      if (table === 'user_profiles') return actorsQuery;
      throw new Error(`unexpected table: ${table}`);
    }),
  });

  return { auditQuery, actorsQuery };
}

async function renderPage() {
  return renderToStaticMarkup(await OwnerAuditLogsPage({ searchParams: {} }));
}

describe('OwnerAuditLogsPage SSR smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedRole.mockResolvedValue(authContext);
  });

  it('renders safe flat metadata details for external API key audit logs', async () => {
    const { auditQuery, actorsQuery } = configureAuditQueries();

    const html = await renderPage();

    expect(mocks.requireAuthenticatedRole).toHaveBeenCalledWith(['owner']);
    expect(auditQuery.select).toHaveBeenCalledWith(
      'id, actor_user_id, action, target_table, target_id, metadata, created_at'
    );
    expect(auditQuery.eq).toHaveBeenCalledWith('organization_id', 'organization-1');
    expect(auditQuery.limit).toHaveBeenCalledWith(200);
    expect(actorsQuery.in).toHaveBeenCalledWith('id', ['owner-user-1']);
    expect(html).toContain('外部連携APIキーを発行');
    expect(html).toContain('キー名');
    expect(html).toContain('日報アプリ本番');
    expect(html).toContain('許可スコープ');
    expect(html).toContain('attendance:read');
    expect(html).toContain('有効状態');
    expect(html).toContain('はい');
    expect(html).toContain('値');
  });
});
