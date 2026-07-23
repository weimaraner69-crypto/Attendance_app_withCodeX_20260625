import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { getStaffAuthActionLabel, StaffAuthStatus } from './StaffAuthStatus';

describe('StaffAuthStatus', () => {
  it('renders success messages as an atomic status', () => {
    const html = renderToStaticMarkup(
      createElement(StaffAuthStatus, {
        kind: 'success',
        message: '招待メールを送信しました。',
      })
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('招待メールを送信しました。');
  });

  it.each([
    ['error', '招待メールを送信できませんでした。'],
    ['partial-success', '招待は完了しましたが、監査ログを保存できませんでした。'],
  ] as const)('renders %s messages as alerts', (kind, message) => {
    const html = renderToStaticMarkup(createElement(StaffAuthStatus, { kind, message }));

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain(message);
  });

  it('includes the staff name in invite and reset accessible labels', () => {
    expect(getStaffAuthActionLabel('invite', '田中 太郎')).toContain('田中 太郎');
    expect(getStaffAuthActionLabel('reset', '田中 太郎')).toContain('田中 太郎');
    expect(getStaffAuthActionLabel('invite', '田中 太郎')).toContain('招待');
    expect(getStaffAuthActionLabel('reset', '田中 太郎')).toContain('再設定');
  });
});
