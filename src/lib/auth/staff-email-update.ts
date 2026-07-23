import { normalizeStaffEmail, type StaffAuthOperations } from './staff-auth';

export type StaffEmailUpdateState = {
  authUserId: string | null;
  currentEmail: string | null;
};

export function resolveStaffEmailUpdate(
  state: StaffEmailUpdateState,
  submittedEmail: string | null | undefined
) {
  if (state.authUserId) return state.currentEmail;

  const email = normalizeStaffEmail(submittedEmail);
  return email || null;
}

export async function isStaffEmailAvailable(input: {
  operations: Pick<StaffAuthOperations, 'findProfilesByEmail' | 'findStaffByEmail'>;
  organizationId: string;
  staffId?: string;
  email: string | null;
}) {
  const { operations, organizationId, staffId, email } = input;
  if (!email) return true;

  const normalizedEmail = normalizeStaffEmail(email);
  const [profiles, staffRows] = await Promise.all([
    operations.findProfilesByEmail(normalizedEmail),
    operations.findStaffByEmail(organizationId, normalizedEmail),
  ]);

  return profiles.length === 0 && staffRows.every((staff) => staff.id === staffId);
}
