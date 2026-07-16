import type { StaffPasswordIntentType } from './staff-password-intent';

export type StaffAuthConfirmationOperations = {
  verifyOtp: (tokenHash: string, type: StaffPasswordIntentType) => Promise<string | null>;
  hasValidStaffIdentity: (userId: string) => Promise<boolean>;
  createIntent: (userId: string, type: StaffPasswordIntentType) => Promise<boolean>;
};

export type StaffAuthConfirmationResult =
  | { ok: true; type: StaffPasswordIntentType; userId: string }
  | { ok: false; code: 'invalid_parameters' | 'invalid_token' | 'invalid_identity' | 'intent_failed' };

function parseType(value: string | null): StaffPasswordIntentType | null {
  return value === 'invite' || value === 'recovery' ? value : null;
}

export async function confirmStaffAuthLink(
  requestUrl: string,
  operations: StaffAuthConfirmationOperations
): Promise<StaffAuthConfirmationResult> {
  const url = new URL(requestUrl);
  const tokenHash = url.searchParams.get('token_hash')?.trim();
  const type = parseType(url.searchParams.get('type'));
  if (!tokenHash || !type) return { ok: false, code: 'invalid_parameters' };

  const userId = await operations.verifyOtp(tokenHash, type);
  if (!userId) return { ok: false, code: 'invalid_token' };

  if (!await operations.hasValidStaffIdentity(userId)) {
    return { ok: false, code: 'invalid_identity' };
  }

  if (!await operations.createIntent(userId, type)) {
    return { ok: false, code: 'intent_failed' };
  }
  return { ok: true, type, userId };
}
