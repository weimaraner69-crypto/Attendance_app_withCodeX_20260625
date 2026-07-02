import { NextResponse } from 'next/server';

import {
  getPrimaryAuthSession,
  unlockAppSession,
} from '@/lib/auth/device-session';
import { createLoginResponse } from '@/lib/auth/login-response';
import { verifyPin } from '@/lib/auth/pin';
import { getRawAuthContext } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

export async function POST(request: Request) {
  const context = await getRawAuthContext();
  if (!context || context.profile.role === 'staff') {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  if (!getPrimaryAuthSession(context.user.id)) {
    return NextResponse.json(
      { authenticated: false, password_required: true },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const pin = body?.pin ?? '';
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { message: 'PINは4桁の数字で入力してください' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: pinCredential, error } = await admin
    .from('user_login_pins')
    .select('pin_hash, failed_attempts, locked_until')
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (error || !pinCredential) {
    return NextResponse.json(
      { authenticated: false, password_required: true },
      { status: 401 }
    );
  }

  if (
    pinCredential.locked_until &&
    Date.parse(pinCredential.locked_until) > Date.now()
  ) {
    return NextResponse.json(
      {
        message: 'PINが一時ロックされています。しばらくしてから再度お試しください',
        locked_until: pinCredential.locked_until,
      },
      { status: 423 }
    );
  }

  if (!verifyPin(pin, pinCredential.pin_hash)) {
    const failedAttempts = pinCredential.failed_attempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
        : null;

    await admin
      .from('user_login_pins')
      .update({
        failed_attempts: failedAttempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', context.user.id);

    return NextResponse.json(
      {
        message: lockedUntil
          ? 'PINを5回間違えたため、10分間ロックしました'
          : `PINが違います（あと${MAX_FAILED_ATTEMPTS - failedAttempts}回）`,
        locked_until: lockedUntil,
      },
      { status: 403 }
    );
  }

  await admin
    .from('user_login_pins')
    .update({
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', context.user.id);

  if (!unlockAppSession(context.user.id)) {
    return NextResponse.json(
      { authenticated: false, password_required: true },
      { status: 401 }
    );
  }

  return NextResponse.json(createLoginResponse(context));
}
