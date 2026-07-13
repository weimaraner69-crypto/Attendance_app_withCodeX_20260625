import { describe, expect, it } from 'vitest';

import { getRoleHomePath } from './session';

describe('role home routing', () => {
  it('maps privileged and staff roles to their allowed entry points', () => {
    expect(getRoleHomePath('owner')).toBe('/owner');
    expect(getRoleHomePath('sr')).toBe('/sr');
    expect(getRoleHomePath('manager', 'store-id')).toBe('/manager/store-id');
    expect(getRoleHomePath('manager')).toBe('/manager/login');
    expect(getRoleHomePath('staff')).toBe('/stamp');
  });
});
