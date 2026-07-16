import { NextResponse } from 'next/server';

import {
  clearStaffPasswordIntent,
  getStaffPasswordIntent,
} from '@/lib/auth/staff-password-intent';
import { getRawAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getAuthorizedContext() {
  const context = await getRawAuthContext();
  if (
    !context ||
    context.profile.role !== 'staff' ||
    !context.staff ||
    !getStaffPasswordIntent(context.user.id)
  ) {
    return null;
  }
  return context;
}

export async function GET() {
  const context = await getAuthorizedContext();
  return NextResponse.json(
    { authorized: Boolean(context) },
    { status: context ? 200 : 401, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: Request) {
  const context = await getAuthorizedContext();
  if (!context) {
    return NextResponse.json({ updated: false }, { status: 401 });
  }

  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ updated: false }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ updated: false }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: body.password });
  if (error) {
    return NextResponse.json({ updated: false }, { status: 400 });
  }

  clearStaffPasswordIntent();
  await supabase.auth.signOut({ scope: 'local' });
  return NextResponse.json({ updated: true }, { headers: { 'Cache-Control': 'no-store' } });
}
