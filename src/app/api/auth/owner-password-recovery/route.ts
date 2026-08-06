import { NextResponse } from 'next/server';

import {
  createOwnerPasswordRecoveryOperations,
  createOwnerPasswordRecoveryRateLimitOperations,
} from '@/lib/auth/owner-auth-operations';
import {
  consumeOwnerPasswordRecoveryRateLimit,
  enforceOwnerPasswordRecoveryResponseFloor,
  readOwnerPasswordRecoveryEmail,
} from '@/lib/auth/owner-password-recovery-guard';
import {
  buildOwnerPasswordRecoveryUrl,
  requestOwnerPasswordRecovery,
} from '@/lib/auth/owner-password-recovery';
import {
  createSupabaseAdminClient,
  createSupabaseTransientAuthClient,
} from '@/lib/supabase';
import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

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
  const startedAt = Date.now();
  try {
    const requestOrigin = request.headers.get('origin');
    if (requestOrigin !== new URL(request.url).origin) {
      return acceptedResponse();
    }

    const email = await readOwnerPasswordRecoveryEmail(request);
    const redirectTo = buildOwnerPasswordRecoveryUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (!redirectTo) return acceptedResponse();

    const admin = createSupabaseAdminClient();
    const rateLimitAllowed = await consumeOwnerPasswordRecoveryRateLimit({
      email,
      headers: request.headers,
      secret: getSupabaseServiceRoleKey(),
      operations: createOwnerPasswordRecoveryRateLimitOperations(admin),
    });
    if (!rateLimitAllowed) return acceptedResponse();

    const auth = createSupabaseTransientAuthClient();
    await requestOwnerPasswordRecovery({
      email,
      redirectTo,
      operations: createOwnerPasswordRecoveryOperations(admin, auth),
    });
  } catch {
    // Public responses must not reveal account or infrastructure state.
  } finally {
    await enforceOwnerPasswordRecoveryResponseFloor(startedAt).catch(() => undefined);
  }
  return acceptedResponse();
}
