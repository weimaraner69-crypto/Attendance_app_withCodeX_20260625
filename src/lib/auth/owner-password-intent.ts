import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const OWNER_PASSWORD_INTENT_COOKIE = 'attendance_owner_password_recovery_intent';
export const OWNER_PASSWORD_INTENT_TTL_SECONDS = 10 * 60;

export function generateOwnerPasswordIntentToken() {
  return randomBytes(32).toString('base64url');
}

export function hashOwnerPasswordIntentToken(token: string) {
  return createHash('sha256')
    .update(`attendance-owner-password-recovery:${token}`)
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

export function setOwnerPasswordIntentCookie(token: string) {
  cookies().set(OWNER_PASSWORD_INTENT_COOKIE, token, {
    ...cookieOptions(),
    maxAge: OWNER_PASSWORD_INTENT_TTL_SECONDS,
  });
}

export function getOwnerPasswordIntentToken() {
  return cookies().get(OWNER_PASSWORD_INTENT_COOKIE)?.value ?? null;
}

export function clearOwnerPasswordIntent() {
  cookies().set(OWNER_PASSWORD_INTENT_COOKIE, '', {
    ...cookieOptions(),
    maxAge: 0,
  });
}
