import { describe, expect, it } from 'vitest';

import { recoverAction } from './action-recovery';

describe('recoverAction', () => {
  it('returns a client-safe fallback when an action rejects', async () => {
    const fallback = { status: 'error' as const, message: '操作に失敗しました。再試行してください。' };

    await expect(
      recoverAction(
        async () => Promise.reject(new Error('session details must not reach the UI')),
        fallback
      )
    ).resolves.toEqual(fallback);
  });
});
