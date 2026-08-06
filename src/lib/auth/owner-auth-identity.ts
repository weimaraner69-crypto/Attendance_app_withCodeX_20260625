export type OwnerProfileReference = {
  id: string;
  organization_id: string;
  role: string;
  email: string;
  is_active: boolean;
};

export type OwnerAuthUserReference = {
  id: string;
  email: string | null;
};

export type OwnerAuthIdentityOperations = {
  getProfile: (userId: string) => Promise<OwnerProfileReference | null>;
  getAuthUser: (userId: string) => Promise<OwnerAuthUserReference | null>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOwnerEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function isValidOwnerEmail(value: string | null | undefined) {
  return emailPattern.test(normalizeOwnerEmail(value));
}

export function hasValidOwnerAuthIdentity(input: {
  userId: string;
  profile: OwnerProfileReference | null;
  authUser: OwnerAuthUserReference | null;
}) {
  const { userId, profile, authUser } = input;
  if (!profile || !authUser) return false;
  if (profile.id !== userId || authUser.id !== userId) return false;
  if (profile.role !== 'owner' || !profile.is_active) return false;

  const profileEmail = normalizeOwnerEmail(profile.email);
  return isValidOwnerEmail(profileEmail) && profileEmail === normalizeOwnerEmail(authUser.email);
}

export async function hasValidOwnerAuthIdentityForUser(
  userId: string,
  operations: OwnerAuthIdentityOperations
) {
  try {
    const profile = await operations.getProfile(userId);
    if (!profile || profile.id !== userId || profile.role !== 'owner' || !profile.is_active) {
      return false;
    }

    const authUser = await operations.getAuthUser(userId);
    return hasValidOwnerAuthIdentity({ userId, profile, authUser });
  } catch {
    return false;
  }
}
