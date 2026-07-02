import { NextResponse } from 'next/server';

import {
  getPrimaryAuthSession,
  startPrimaryAuthSession,
} from '@/lib/auth/device-session';
import { createLoginResponse } from '@/lib/auth/login-response';
import { hashPin } from '@/lib/auth/pin';
import { getRawAuthContext } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  const context = await getRawAuthContext();
  if (!context || context.profile.role === 'staff') {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  if (!getPrimaryAuthSession(context.user.id)) {
    return NextResponse.json(
      { authenticated: false, message: 'メールアドレスとパスワードでもう一度ログインしてください' },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { pin?: string; pin_confirmation?: string }
    | null;
  const pin = body?.pin ?? '';

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { message: 'PINは4桁の数字で入力してください' },
      { status: 400 }
    );
  }
  if (pin !== body?.pin_confirmation) {
    return NextResponse.json(
      { message: '確認用PINが一致しません' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('user_login_pins')
    .upsert(
      {
        user_id: context.user.id,
        organization_id: context.profile.organization_id,
        pin_hash: hashPin(pin),
        pin_updated_at: new Date().toISOString(),
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    return NextResponse.json(
      { message: 'PINを設定できませんでした' },
      { status: 500 }
    );
  }

  startPrimaryAuthSession(context.user.id);
  return NextResponse.json(createLoginResponse(context));
}
