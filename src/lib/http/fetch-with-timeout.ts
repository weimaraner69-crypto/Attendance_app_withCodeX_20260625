export function createFetchWithTimeout(
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const callerSignal = init?.signal;
    const abortFromCaller = () => controller.abort(callerSignal?.reason);

    if (callerSignal?.aborted) abortFromCaller();
    else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

    const timer = setTimeout(
      () => controller.abort(new Error('request timed out')),
      timeoutMs
    );
    try {
      return await fetchImplementation(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }
  };
}
