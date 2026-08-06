import {
  hasValidOwnerAuthIdentity,
  isValidOwnerEmail,
  normalizeOwnerEmail,
  type OwnerAuthUserReference,
  type OwnerProfileReference,
} from './owner-auth-identity';

export type OwnerPasswordRecoveryOperations = {
  findProfilesByEmail: (email: string) => Promise<OwnerProfileReference[]>;
  getAuthUser: (userId: string) => Promise<OwnerAuthUserReference | null>;
  sendPasswordReset: (email: string, redirectTo: string) => Promise<boolean>;
};

export type OwnerPasswordRecoveryResult = {
  accepted: true;
};

const accepted: OwnerPasswordRecoveryResult = { accepted: true };

export function buildOwnerPasswordRecoveryUrl(appUrl: string | undefined) {
  if (!appUrl?.trim()) return null;

  try {
    const url = new URL(appUrl.trim());
    const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const validProtocol = url.protocol === 'https:' || (localHost && url.protocol === 'http:');
    const hasOriginOnlyPath = url.pathname === '/' && !url.search && !url.hash;

    if (!validProtocol || !hasOriginOnlyPath || url.username || url.password) {
      return null;
    }

    return new URL('/auth/owner-confirm', url.origin).toString();
  } catch {
    return null;
  }
}

export async function requestOwnerPasswordRecovery(input: {
  email: string | null | undefined;
  redirectTo: string;
  operations: OwnerPasswordRecoveryOperations;
}): Promise<OwnerPasswordRecoveryResult> {
  const { redirectTo, operations } = input;
  const email = normalizeOwnerEmail(input.email);
  if (!isValidOwnerEmail(email)) return accepted;

  try {
    const profiles = await operations.findProfilesByEmail(email);
    if (profiles.length !== 1) return accepted;

    const profile = profiles[0];
    if (normalizeOwnerEmail(profile.email) !== email) return accepted;

    const authUser = await operations.getAuthUser(profile.id);
    if (!hasValidOwnerAuthIdentity({ userId: profile.id, profile, authUser })) {
      return accepted;
    }

    await operations.sendPasswordReset(email, redirectTo);
  } catch {
    // The public response is intentionally indistinguishable from an unknown account.
  }

  return accepted;
}
