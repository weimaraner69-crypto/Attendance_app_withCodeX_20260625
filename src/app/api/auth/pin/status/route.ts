import { NextResponse } from 'next/server';

import {
  clearAppUnlockCookie,
  getPrimaryAuthSession,
} from '@/lib/auth/device-session';
import { getRawAuthContext } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await getRawAuthContext();
  if (!context || context.profile.role === 'staff') {
    return NextResponse.json({ pin_available: false });
  }

  const primary = getPrimaryAuthSession(context.user.id);
  if (!primary) {
    clearAppUnlockCookie();
    return NextResponse.json({ pin_available: false });
  }

  const admin = createSupabaseAdminClient();
  const { data: pinCredential } = await admin
    .from('user_login_pins')
    .select('user_id, locked_until')
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (!pinCredential) {
    return NextResponse.json({ pin_available: false });
  }

  return NextResponse.json({
    pin_available: true,
    profile: {
      role: context.profile.role,
      display_name: context.profile.display_name,
    },
    expires_at: new Date(primary.exp * 1000).toISOString(),
    locked_until: pinCredential.locked_until,
  });
}
