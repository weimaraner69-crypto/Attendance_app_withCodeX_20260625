import { redirect } from 'next/navigation';

import { clearAppUnlockCookie } from '@/lib/auth/device-session';
import { getRawAuthContext } from '@/lib/auth/session';

export async function POST() {
  const context = await getRawAuthContext();
  clearAppUnlockCookie();

  redirect(context?.profile.role === 'manager' ? '/manager/login' : '/login');
}
