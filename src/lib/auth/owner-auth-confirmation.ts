export type OwnerAuthConfirmationOperations = {
  verifyRecoveryOtp: (tokenHash: string) => Promise<string | null>;
  hasValidOwnerIdentity: (userId: string) => Promise<boolean>;
  createIntent: (userId: string) => Promise<boolean>;
};

export type OwnerAuthConfirmationResult =
  | { ok: true; userId: string }
  | { ok: false; code: 'invalid_parameters' | 'invalid_token' | 'invalid_identity' | 'intent_failed' };

export async function confirmOwnerPasswordRecoveryLink(
  requestUrl: string,
  operations: OwnerAuthConfirmationOperations
): Promise<OwnerAuthConfirmationResult> {
  const url = new URL(requestUrl);
  const tokenHash = url.searchParams.get('token_hash')?.trim();
  if (!tokenHash || url.searchParams.get('type') !== 'recovery') {
    return { ok: false, code: 'invalid_parameters' };
  }

  const userId = await operations.verifyRecoveryOtp(tokenHash);
  if (!userId) return { ok: false, code: 'invalid_token' };
  if (!await operations.hasValidOwnerIdentity(userId)) {
    return { ok: false, code: 'invalid_identity' };
  }
  if (!await operations.createIntent(userId)) {
    return { ok: false, code: 'intent_failed' };
  }
  return { ok: true, userId };
}
