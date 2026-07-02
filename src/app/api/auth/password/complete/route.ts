import { NextResponse } from 'next/server';

import { startPrimaryAuthSession } from '@/lib/auth/device-session';
import { createLoginResponse } from '@/lib/auth/login-response';
import { getRawAuthContext } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const RECENT_PASSWORD_AUTH_WINDOW_MS = 5 * 60_000;

export async function POST(request: Request) {
  const context = await getRawAuthContext();
  if (!context) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  if (context.profile.role === 'staff') {
    return NextResponse.json(
      { authenticated: false, message: 'このログイン方式は管理ユーザー専用です' },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { expected_role?: string }
    | null;
  if (body?.expected_role !== context.profile.role) {
    return NextResponse.json(
      { authenticated: false, message: '選択したロールとユーザー権限が一致しません' },
      { status: 403 }
    );
  }

  const lastSignInAt = context.user.last_sign_in_at
    ? Date.parse(context.user.last_sign_in_at)
    : Number.NaN;
  if (
    !Number.isFinite(lastSignInAt) ||
    Date.now() - lastSignInAt > RECENT_PASSWORD_AUTH_WINDOW_MS
  ) {
    return NextResponse.json(
      {
        authenticated: false,
        message: 'メールアドレスとパスワードでもう一度ログインしてください',
      },
      { status: 401 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: pinCredential, error } = await admin
    .from('user_login_pins')
    .select('user_id')
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { authenticated: false, message: 'PIN設定を確認できませんでした' },
      { status: 500 }
    );
  }

  if (!pinCredential) {
    startPrimaryAuthSession(context.user.id, false);
    return NextResponse.json({
      authenticated: true,
      requires_pin_setup: true,
      profile: {
        role: context.profile.role,
        display_name: context.profile.display_name,
      },
    });
  }

  startPrimaryAuthSession(context.user.id);
  return NextResponse.json(createLoginResponse(context));
}
