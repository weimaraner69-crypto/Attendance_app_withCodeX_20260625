import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

const PRIMARY_AUTH_COOKIE = 'attendance_primary_auth';
const APP_UNLOCK_COOKIE = 'attendance_app_unlock';

export const PRIMARY_AUTH_TTL_SECONDS = 6 * 60 * 60;

type DeviceSessionKind = 'primary' | 'unlock';

type DeviceSessionPayload = {
  sub: string;
  kind: DeviceSessionKind;
  exp: number;
};

function sign(value: string) {
  return createHmac('sha256', getSupabaseServiceRoleKey())
    .update(`attendance-device-session:${value}`)
    .digest('base64url');
}

function encode(payload: DeviceSessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decode(value: string | undefined, kind: DeviceSessionKind, userId: string) {
  if (!value) return null;

  const [encodedPayload, providedSignature] = value.split('.');
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(providedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as DeviceSessionPayload;

    if (
      payload.kind !== kind ||
      payload.sub !== userId ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
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

export function getPrimaryAuthSession(userId: string) {
  return decode(cookies().get(PRIMARY_AUTH_COOKIE)?.value, 'primary', userId);
}

export function isAppUnlocked(userId: string) {
  const primary = getPrimaryAuthSession(userId);
  const unlock = decode(cookies().get(APP_UNLOCK_COOKIE)?.value, 'unlock', userId);

  return Boolean(primary && unlock && unlock.exp === primary.exp);
}

export function startPrimaryAuthSession(userId: string, unlock = true) {
  const expiresAt = Math.floor(Date.now() / 1000) + PRIMARY_AUTH_TTL_SECONDS;
  const cookieStore = cookies();
  const options = cookieOptions();

  cookieStore.set(
    PRIMARY_AUTH_COOKIE,
    encode({ sub: userId, kind: 'primary', exp: expiresAt }),
    {
      ...options,
      maxAge: PRIMARY_AUTH_TTL_SECONDS,
    }
  );
  if (unlock) {
    cookieStore.set(
      APP_UNLOCK_COOKIE,
      encode({ sub: userId, kind: 'unlock', exp: expiresAt }),
      options
    );
  } else {
    clearAppUnlockCookie();
  }

  return expiresAt;
}

export function unlockAppSession(userId: string) {
  const primary = getPrimaryAuthSession(userId);
  if (!primary) return false;

  cookies().set(
    APP_UNLOCK_COOKIE,
    encode({ sub: userId, kind: 'unlock', exp: primary.exp }),
    cookieOptions()
  );
  return true;
}

export function clearAppUnlockCookie() {
  cookies().set(APP_UNLOCK_COOKIE, '', {
    ...cookieOptions(),
    maxAge: 0,
  });
}

export function clearDeviceSessionCookies() {
  const options = cookieOptions();
  const cookieStore = cookies();

  cookieStore.set(PRIMARY_AUTH_COOKIE, '', { ...options, maxAge: 0 });
  cookieStore.set(APP_UNLOCK_COOKIE, '', { ...options, maxAge: 0 });
}
