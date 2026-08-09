import { randomUUID } from 'crypto';

import { hashOwnerPasswordIntentToken } from './owner-password-intent';

export type OwnerPasswordIntentRecord = {
  id: string;
  user_id: string;
};

export type OwnerPasswordUpdateOperations = {
  findActiveIntent: (tokenHash: string) => Promise<OwnerPasswordIntentRecord | null>;
  hasValidOwnerIdentity: (userId: string) => Promise<boolean>;
  claimIntent: (
    tokenHash: string,
    claimId: string
  ) => Promise<OwnerPasswordIntentRecord | 'busy' | null>;
  releaseIntent: (intentId: string, claimId: string) => Promise<boolean>;
  finalizeIntent: (
    intentId: string,
    claimId: string,
    outcome: 'updated' | 'identity_changed' | 'update_unknown'
  ) => Promise<boolean>;
  quarantineIntent: (
    intentId: string,
    claimId: string,
    outcome: 'identity_changed' | 'update_unknown'
  ) => Promise<boolean>;
  updatePassword: (
    userId: string,
    password: string
  ) => Promise<'updated' | 'rejected' | 'unknown'>;
  disableAuthCredentials: (userId: string) => Promise<boolean>;
};

export type OwnerPasswordUpdateResult =
  | { ok: true; code: 'updated' }
  | {
      ok: false;
      code:
        | 'invalid_intent'
        | 'claim_busy'
        | 'invalid_identity'
        | 'update_failed_retryable'
        | 'update_unknown'
        | 'finalize_failed'
        | 'compensation_failed';
    };

export function classifyOwnerAuthUpdateError(
  status: unknown
): 'rejected' | 'unknown' {
  return typeof status === 'number' && status >= 400 && status < 500
    ? 'rejected'
    : 'unknown';
}

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
  const claimId = randomUUID();
  const claim = await operations.claimIntent(hashOwnerPasswordIntentToken(token), claimId);
  if (claim === 'busy') return { ok: false, code: 'claim_busy' };
  if (!claim) return { ok: false, code: 'invalid_intent' };
  const intent = claim;

  if (!await operations.hasValidOwnerIdentity(intent.user_id)) {
    return await operations.finalizeIntent(intent.id, claimId, 'identity_changed')
      ? { ok: false, code: 'invalid_identity' }
      : { ok: false, code: 'finalize_failed' };
  }

  const updateResult = await operations.updatePassword(intent.user_id, password);
  if (updateResult === 'rejected') {
    return await operations.releaseIntent(intent.id, claimId)
      ? { ok: false, code: 'update_failed_retryable' }
      : { ok: false, code: 'finalize_failed' };
  }

  if (updateResult === 'unknown') {
    const quarantined = await operations.quarantineIntent(
      intent.id,
      claimId,
      'update_unknown'
    );
    const credentialsDisabled = await operations.disableAuthCredentials(intent.user_id);
    return quarantined && credentialsDisabled
      ? { ok: false, code: 'update_unknown' }
      : { ok: false, code: 'compensation_failed' };
  }

  if (!await operations.hasValidOwnerIdentity(intent.user_id)) {
    const quarantined = await operations.quarantineIntent(
      intent.id,
      claimId,
      'identity_changed'
    );
    const credentialsDisabled = await operations.disableAuthCredentials(intent.user_id);
    return quarantined && credentialsDisabled
      ? { ok: false, code: 'invalid_identity' }
      : { ok: false, code: 'compensation_failed' };
  }

  return await operations.finalizeIntent(intent.id, claimId, 'updated')
    ? { ok: true, code: 'updated' }
    : { ok: false, code: 'finalize_failed' };
}
