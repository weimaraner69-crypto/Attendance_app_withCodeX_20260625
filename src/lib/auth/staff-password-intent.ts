import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

const STAFF_PASSWORD_INTENT_COOKIE = 'attendance_staff_password_intent';
export const STAFF_PASSWORD_INTENT_TTL_SECONDS = 10 * 60;

export type StaffPasswordIntentType = 'invite' | 'recovery';

type StaffPasswordIntentPayload = {
  sub: string;
  type: StaffPasswordIntentType;
  exp: number;
  nonce: string;
};

function sign(value: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`attendance-staff-password:${value}`)
    .digest('base64url');
}

export function createStaffPasswordIntentToken(
  payload: StaffPasswordIntentPayload,
  secret: string
) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyStaffPasswordIntentToken(
  value: string | undefined,
  userId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!value) return null;

  const [encodedPayload, providedSignature] = value.split('.');
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const provided = Buffer.from(providedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as StaffPasswordIntentPayload;
    if (
      payload.sub !== userId ||
      (payload.type !== 'invite' && payload.type !== 'recovery') ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= nowSeconds ||
      typeof payload.nonce !== 'string' ||
      payload.nonce.length < 16
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function startStaffPasswordIntent(userId: string, type: StaffPasswordIntentType) {
  const now = Math.floor(Date.now() / 1000);
  const token = createStaffPasswordIntentToken(
    {
      sub: userId,
      type,
      exp: now + STAFF_PASSWORD_INTENT_TTL_SECONDS,
      nonce: randomBytes(16).toString('base64url'),
    },
    getSupabaseServiceRoleKey()
  );
  cookies().set(STAFF_PASSWORD_INTENT_COOKIE, token, {
    ...cookieOptions(),
    maxAge: STAFF_PASSWORD_INTENT_TTL_SECONDS,
  });
}

export function getStaffPasswordIntent(userId: string) {
  return verifyStaffPasswordIntentToken(
    cookies().get(STAFF_PASSWORD_INTENT_COOKIE)?.value,
    userId,
    getSupabaseServiceRoleKey()
  );
}

export function clearStaffPasswordIntent() {
  cookies().set(STAFF_PASSWORD_INTENT_COOKIE, '', {
    ...cookieOptions(),
    maxAge: 0,
  });
}
