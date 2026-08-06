import { NextResponse } from 'next/server';

import { createOwnerPasswordRecoveryOperations } from '@/lib/auth/owner-auth-operations';
import {
  buildOwnerPasswordRecoveryUrl,
  requestOwnerPasswordRecovery,
} from '@/lib/auth/owner-password-recovery';
import {
  createSupabaseAdminClient,
  createSupabaseTransientAuthClient,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const publicResult = {
  accepted: true,
  message: '該当するオーナーアカウントがある場合、再設定メールを送信しました。',
};

function acceptedResponse() {
  return NextResponse.json(publicResult, {
    status: 202,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin !== new URL(request.url).origin) {
    return acceptedResponse();
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email : null;
  const redirectTo = buildOwnerPasswordRecoveryUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!redirectTo) return acceptedResponse();

  try {
    const admin = createSupabaseAdminClient();
    const auth = createSupabaseTransientAuthClient();
    await requestOwnerPasswordRecovery({
      email,
      redirectTo,
      operations: createOwnerPasswordRecoveryOperations(admin, auth),
    });
  } catch {
    // Public responses must not reveal account or infrastructure state.
  }
  return acceptedResponse();
}
