import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { hasValidStaffAuthIdentity } from '@/lib/auth/staff-auth-identity';
import { buildStaffPasswordUrl } from '@/lib/auth/staff-auth';
import {
  clearStaffPasswordIntent,
  getStaffPasswordIntentToken,
} from '@/lib/auth/staff-password-intent';
import {
  updateStaffPasswordWithIntent,
  validateStaffPasswordIntent,
  type StaffPasswordUpdateOperations,
} from '@/lib/auth/staff-password-update';
import { createSupabaseAdminClient, type Database } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function createOperations(
  admin: SupabaseClient<Database>
): StaffPasswordUpdateOperations {
  return {
    async findActiveIntent(tokenHash) {
      const { data, error } = await admin
        .from('staff_password_intents')
        .select('id, user_id, intent_type')
        .eq('token_hash', tokenHash)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id,
        user_id: data.user_id,
        intent_type: data.intent_type as 'invite' | 'recovery',
      };
    },
    hasValidStaffIdentity: (userId) => hasValidStaffAuthIdentity(admin, userId),
    async claimIntent(intentId) {
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from('staff_password_intents')
        .update({ consumed_at: now })
        .eq('id', intentId)
        .is('consumed_at', null)
        .gt('expires_at', now)
        .select('id')
        .maybeSingle();
      return !error && Boolean(data);
    },
    async updatePassword(userId, password) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      return !error;
    },
  };
}

export async function GET() {
  const token = getStaffPasswordIntentToken();
  const admin = createSupabaseAdminClient();
  const intent = token
    ? await validateStaffPasswordIntent(token, createOperations(admin))
    : null;
  if (!intent) clearStaffPasswordIntent();
  return NextResponse.json(
    { authorized: Boolean(intent) },
    { status: intent ? 200 : 401, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin');
  const staffPasswordUrl = buildStaffPasswordUrl(process.env.NEXT_PUBLIC_APP_URL);
  const configuredOrigin = staffPasswordUrl ? new URL(staffPasswordUrl).origin : null;
  if (!configuredOrigin || requestOrigin !== configuredOrigin) {
    return NextResponse.json({ updated: false }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ updated: false }, { status: 400 });
  }

  const token = getStaffPasswordIntentToken();
  if (!token) {
    return NextResponse.json({ updated: false }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const result = await updateStaffPasswordWithIntent({
    token,
    password: body.password,
    operations: createOperations(admin),
  });
  clearStaffPasswordIntent();

  if (!result.ok) {
    const status = result.code === 'update_failed' ? 400 : 401;
    return NextResponse.json({ updated: false }, { status });
  }
  return NextResponse.json({ updated: true }, { headers: { 'Cache-Control': 'no-store' } });
}
