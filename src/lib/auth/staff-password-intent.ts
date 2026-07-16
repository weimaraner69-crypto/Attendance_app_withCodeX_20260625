import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const STAFF_PASSWORD_INTENT_COOKIE = 'attendance_staff_password_intent';
const STAFF_PASSWORD_FLOW_GUARD_COOKIE = 'attendance_staff_password_flow';
export const STAFF_PASSWORD_INTENT_TTL_SECONDS = 10 * 60;

export type StaffPasswordIntentType = 'invite' | 'recovery';

export function generateStaffPasswordIntentToken() {
  return randomBytes(32).toString('base64url');
}

export function hashStaffPasswordIntentToken(token: string) {
  return createHash('sha256')
    .update(`attendance-staff-password:${token}`)
    .digest('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setStaffPasswordIntentCookie(token: string) {
  cookies().set(STAFF_PASSWORD_INTENT_COOKIE, token, {
    ...cookieOptions(),
    maxAge: STAFF_PASSWORD_INTENT_TTL_SECONDS,
  });
}

export function getStaffPasswordIntentToken() {
  return cookies().get(STAFF_PASSWORD_INTENT_COOKIE)?.value ?? null;
}

export function clearStaffPasswordIntent() {
  cookies().set(STAFF_PASSWORD_INTENT_COOKIE, '', {
    ...cookieOptions(),
    maxAge: 0,
  });
}

export function startStaffPasswordFlowGuard() {
  cookies().set(STAFF_PASSWORD_FLOW_GUARD_COOKIE, '1', {
    ...cookieOptions(),
    maxAge: STAFF_PASSWORD_INTENT_TTL_SECONDS,
  });
}

export function clearStaffPasswordFlowGuard() {
  cookies().set(STAFF_PASSWORD_FLOW_GUARD_COOKIE, '', {
    ...cookieOptions(),
    maxAge: 0,
  });
}

export function hasStaffPasswordFlowCookie() {
  const cookieStore = cookies();
  return Boolean(
    cookieStore.get(STAFF_PASSWORD_FLOW_GUARD_COOKIE)?.value ||
    cookieStore.get(STAFF_PASSWORD_INTENT_COOKIE)?.value
  );
}
