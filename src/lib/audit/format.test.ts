import { describe, expect, it } from 'vitest';

import { formatAuditValue, getAuditChanges, getAuditDetailRows } from './format';

describe('audit format helpers', () => {
  it('formats array values for safe owner-facing display', () => {
    expect(formatAuditValue(['attendance:read'])).toBe('attendance:read');
    expect(formatAuditValue(['attendance:read', 'stores:read'])).toBe(
      'attendance:read, stores:read'
    );
  });

  it('returns before/after changes when structured metadata is present', () => {
    expect(
      getAuditChanges({
        before: { status: 'pending', reviewed_at: null },
        after: { status: 'approved', reviewed_at: '2026-07-25T00:00:00.000Z' },
      })
    ).toEqual([
      { key: 'status', before: 'pending', after: 'approved' },
      { key: 'reviewed_at', before: null, after: '2026-07-25T00:00:00.000Z' },
    ]);
  });

  it('derives safe detail rows from flat external API key audit metadata', () => {
    expect(
      getAuditDetailRows('external_api_key.issued', {
        name: '日報アプリ本番',
        scopes: ['attendance:read'],
        expires_at: null,
        is_active: true,
      })
    ).toEqual([
      { key: 'name', before: undefined, after: '日報アプリ本番' },
      { key: 'scopes', before: undefined, after: ['attendance:read'] },
      { key: 'expires_at', before: undefined, after: null },
      { key: 'is_active', before: undefined, after: true },
    ]);
  });

  it('shows the active flag transition for API key deactivation logs', () => {
    expect(
      getAuditDetailRows('external_api_key.deactivated', {
        name: '日報アプリ本番',
        scopes: ['attendance:read'],
        expires_at: null,
        is_active: false,
      })
    ).toContainEqual({ key: 'is_active', before: true, after: false });
  });
});
