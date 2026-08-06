import { hashOwnerPasswordIntentToken } from './owner-password-intent';

export type OwnerPasswordIntentRecord = {
  id: string;
  user_id: string;
};

export type OwnerPasswordUpdateOperations = {
  findActiveIntent: (tokenHash: string) => Promise<OwnerPasswordIntentRecord | null>;
  hasValidOwnerIdentity: (userId: string) => Promise<boolean>;
  claimIntent: (intentId: string) => Promise<boolean>;
  updatePassword: (userId: string, password: string) => Promise<boolean>;
};

export type OwnerPasswordUpdateResult =
  | { ok: true; code: 'updated' }
  | { ok: false; code: 'invalid_intent' | 'invalid_identity' | 'already_consumed' | 'update_failed' };

export async function validateOwnerPasswordIntent(
  token: string,
  operations: OwnerPasswordUpdateOperations
) {
  const intent = await operations.findActiveIntent(hashOwnerPasswordIntentToken(token));
  if (!intent) return null;
  return await operations.hasValidOwnerIdentity(intent.user_id) ? intent : null;
}

export async function updateOwnerPasswordWithIntent(input: {
  token: string;
  password: string;
  operations: OwnerPasswordUpdateOperations;
}): Promise<OwnerPasswordUpdateResult> {
  const { token, password, operations } = input;
  const intent = await operations.findActiveIntent(hashOwnerPasswordIntentToken(token));
  if (!intent) return { ok: false, code: 'invalid_intent' };
  if (!await operations.hasValidOwnerIdentity(intent.user_id)) {
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
