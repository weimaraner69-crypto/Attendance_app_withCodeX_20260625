import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase';
import { clearDeviceSessionCookies } from '@/lib/auth/device-session';

export async function POST() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  clearDeviceSessionCookies();
  redirect('/login');
}
