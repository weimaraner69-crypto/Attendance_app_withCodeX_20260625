import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFetchWithTimeout } from './fetch-with-timeout';

describe('createFetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts an in-flight request when the hard timeout expires', async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn<typeof fetch>(async (_input, init) => (
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })
    ));
    const timedFetch = createFetchWithTimeout(15_000, fetchImplementation);

    const request = timedFetch('owner-auth-update');
    const rejection = expect(request).rejects.toThrow('request timed out');
    await vi.advanceTimersByTimeAsync(15_000);

    await rejection;
  });

  it('forwards an earlier caller abort', async () => {
    const caller = new AbortController();
    const fetchImplementation = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal?.aborted).toBe(true);
      throw init?.signal?.reason;
    });
    const timedFetch = createFetchWithTimeout(15_000, fetchImplementation);
    caller.abort(new Error('caller aborted'));

    await expect(timedFetch('owner-auth-update', { signal: caller.signal }))
      .rejects.toThrow('caller aborted');
  });
});
