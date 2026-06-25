import { NextResponse } from 'next/server';

import { getCurrentAuthContext, getRoleHomePath } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await getCurrentAuthContext();

  if (!context) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: context.user,
    profile: context.profile,
    manager_store: context.managerStore,
    staff: context.staff,
    redirect_path: getRoleHomePath(context.profile.role, context.managerStore?.id),
  });
}
