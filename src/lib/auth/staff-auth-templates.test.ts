import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function template(name: string) {
  return readFileSync(resolve(process.cwd(), 'supabase', 'templates', name), 'utf8');
}

describe('staff Auth email templates', () => {
  it('routes invite email through the staff confirmation endpoint', () => {
    const html = template('invite.html');
    expect(html).toContain('/auth/confirm?token_hash={{ .TokenHash }}');
    expect(html).toContain('type=invite');
    expect(html).not.toContain('/auth/staff-password?token_hash=');
  });

  it('routes recovery email through the server-selected owner or staff endpoint', () => {
    const html = template('recovery.html');
    expect(html).toContain('{{ .RedirectTo }}?token_hash={{ .TokenHash }}');
    expect(html).toContain('type=recovery');
    expect(html).not.toContain('{{ .SiteURL }}/auth/confirm');
    expect(html).not.toContain('/auth/staff-password?token_hash=');
  });

  it('requires an explicit POST before consuming the one-time token', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'src', 'app', 'auth', 'confirm', 'page.tsx'),
      'utf8'
    );
    expect(page).toContain('action="/auth/confirm/complete"');
    expect(page).toContain('method="post"');
  });
});
