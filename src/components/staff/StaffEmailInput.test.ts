import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StaffEmailInput } from './StaffEmailInput';

describe('StaffEmailInput', () => {
  it('renders linked staff email as read-only with an associated explanation', () => {
    const html = renderToStaticMarkup(createElement(StaffEmailInput, {
      authUserId: 'auth-user-1',
      email: 'linked@example.com',
      staffId: 'staff-1',
      staffName: '田中 太郎',
    }));

    expect(html).toContain('readonly=""');
    expect(html).toContain('aria-describedby="staff-email-staff-1-hint"');
    expect(html).toContain('メールアドレスは変更できません');
  });

  it('keeps unlinked staff email editable without a linked-account explanation', () => {
    const html = renderToStaticMarkup(createElement(StaffEmailInput, {
      authUserId: null,
      email: 'unlinked@example.com',
      staffId: 'staff-2',
      staffName: '佐藤 花子',
    }));

    expect(html).not.toContain('readonly=""');
    expect(html).not.toContain('aria-describedby');
    expect(html).not.toContain('メールアドレスは変更できません');
    expect(html.match(/name="email"/g)).toHaveLength(1);
    expect(html).toContain('value="unlinked@example.com"');
  });
});
