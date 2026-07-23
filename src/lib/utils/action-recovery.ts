export async function recoverAction<T>(action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch {
    return fallback;
  }
}
