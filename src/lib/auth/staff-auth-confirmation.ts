import type { StaffPasswordIntentType } from './staff-password-intent';

export type StaffAuthConfirmationOperations = {
  verifyOtp: (tokenHash: string, type: StaffPasswordIntentType) => Promise<string | null>;
  hasValidStaffIdentity: (userId: string) => Promise<boolean>;
  startFlowGuard: () => void;
  clearFlowGuard: () => void;
  signOut: () => Promise<boolean>;
  createIntent: (userId: string, type: StaffPasswordIntentType) => Promise<boolean>;
};

export type StaffAuthConfirmationResult =
  | { ok: true; type: StaffPasswordIntentType; userId: string }
  | { ok: false; code: 'invalid_parameters' | 'invalid_token' | 'invalid_identity' | 'signout_failed' | 'intent_failed' };

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
  operations.startFlowGuard();

  if (!await operations.hasValidStaffIdentity(userId)) {
    if (await operations.signOut()) operations.clearFlowGuard();
    return { ok: false, code: 'invalid_identity' };
  }

  if (!await operations.signOut()) {
    return { ok: false, code: 'signout_failed' };
  }
  if (!await operations.createIntent(userId, type)) {
    operations.clearFlowGuard();
    return { ok: false, code: 'intent_failed' };
  }
  operations.clearFlowGuard();
  return { ok: true, type, userId };
}
