import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function template(name: string) {
  return readFileSync(resolve(process.cwd(), 'supabase', 'templates', name), 'utf8');
}

describe('staff Auth email templates', () => {
  it.each([
    ['invite.html', 'invite'],
    ['recovery.html', 'recovery'],
  ])('routes %s through the server token confirmation endpoint', (name, type) => {
    const html = template(name);
    expect(html).toContain('/auth/confirm?token_hash={{ .TokenHash }}');
    expect(html).toContain(`type=${type}`);
    expect(html).not.toContain('/auth/staff-password?token_hash=');
  });
});
