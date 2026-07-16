import { hashStaffPasswordIntentToken } from './staff-password-intent';

export type StaffPasswordIntentRecord = {
  id: string;
  user_id: string;
  intent_type: 'invite' | 'recovery';
};

export type StaffPasswordUpdateOperations = {
  findActiveIntent: (tokenHash: string) => Promise<StaffPasswordIntentRecord | null>;
  hasValidStaffIdentity: (userId: string) => Promise<boolean>;
  claimIntent: (intentId: string) => Promise<boolean>;
  updatePassword: (userId: string, password: string) => Promise<boolean>;
};

export type StaffPasswordUpdateResult =
  | { ok: true; code: 'updated' }
  | { ok: false; code: 'invalid_intent' | 'invalid_identity' | 'already_consumed' | 'update_failed' };

export async function validateStaffPasswordIntent(
  token: string,
  operations: StaffPasswordUpdateOperations
) {
  const intent = await operations.findActiveIntent(hashStaffPasswordIntentToken(token));
  if (!intent) return null;
  return await operations.hasValidStaffIdentity(intent.user_id) ? intent : null;
}

export async function updateStaffPasswordWithIntent(input: {
  token: string;
  password: string;
  operations: StaffPasswordUpdateOperations;
}): Promise<StaffPasswordUpdateResult> {
  const { token, password, operations } = input;
  const intent = await operations.findActiveIntent(hashStaffPasswordIntentToken(token));
  if (!intent) return { ok: false, code: 'invalid_intent' };
  if (!await operations.hasValidStaffIdentity(intent.user_id)) {
    return { ok: false, code: 'invalid_identity' };
  }
  if (!await operations.claimIntent(intent.id)) {
    return { ok: false, code: 'already_consumed' };
  }
  if (!await operations.updatePassword(intent.user_id, password)) {
    return { ok: false, code: 'update_failed' };
  }
  return { ok: true, code: 'updated' };
}
