import { randomBytes } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { hasValidOwnerAuthIdentityForUser } from '@/lib/auth/owner-auth-identity';
import { createOwnerAuthIdentityOperations } from '@/lib/auth/owner-auth-operations';
import {
  clearOwnerPasswordIntent,
  getOwnerPasswordIntentToken,
} from '@/lib/auth/owner-password-intent';
import {
  classifyOwnerAuthUpdateError,
  updateOwnerPasswordWithIntent,
  validateOwnerPasswordIntent,
  type OwnerPasswordUpdateOperations,
} from '@/lib/auth/owner-password-update';
import { createSupabaseAdminClient, type Database } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function createOperations(
  admin: SupabaseClient<Database>
): OwnerPasswordUpdateOperations {
  const identityOperations = createOwnerAuthIdentityOperations(admin);
  return {
    async findActiveIntent(tokenHash) {
      const { data, error } = await admin
        .from('owner_password_recovery_intents')
        .select('id, user_id')
        .eq('token_hash', tokenHash)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      return error || !data ? null : data;
    },
    hasValidOwnerIdentity: (userId) => (
      hasValidOwnerAuthIdentityForUser(userId, identityOperations)
    ),
    async claimIntent(tokenHash, claimId) {
      const { data, error } = await admin.rpc(
        'claim_owner_password_recovery_intent',
        { p_token_hash: tokenHash, p_claim_id: claimId }
      );
      if (error || !data?.length) return null;
      return data[0];
    },
    async releaseIntent(intentId, claimId) {
      const { data, error } = await admin.rpc(
        'release_owner_password_recovery_claim',
        { p_intent_id: intentId, p_claim_id: claimId }
      );
      return !error && data === true;
    },
    async finalizeIntent(intentId, claimId, outcome) {
      const { data, error } = await admin.rpc(
        'finalize_owner_password_recovery_claim',
        { p_intent_id: intentId, p_claim_id: claimId, p_outcome: outcome }
      );
      return !error && data === true;
    },
    async quarantineIntent(intentId, claimId, outcome) {
      const { data, error } = await admin.rpc(
        'quarantine_owner_password_recovery_claim',
        { p_intent_id: intentId, p_claim_id: claimId, p_outcome: outcome }
      );
      return !error && data === true;
    },
    async updatePassword(userId, password) {
      try {
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (!error) return 'updated';
        return classifyOwnerAuthUpdateError(error.status);
      } catch {
        return 'unknown';
      }
    },
    async disableAuthCredentials(userId) {
      const password = randomBytes(48).toString('base64url');
      try {
        const { error } = await admin.auth.admin.updateUserById(userId, {
          password,
          ban_duration: '876000h',
        });
        return !error;
      } catch {
        return false;
      }
    },
  };
}

export async function GET() {
  const token = getOwnerPasswordIntentToken();
  const admin = createSupabaseAdminClient();
  const intent = token
    ? await validateOwnerPasswordIntent(token, createOperations(admin))
    : null;
  if (!intent) clearOwnerPasswordIntent();
  return NextResponse.json(
    { authorized: Boolean(intent) },
    { status: intent ? 200 : 401, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ updated: false }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ updated: false }, { status: 400 });
  }

  const token = getOwnerPasswordIntentToken();
  if (!token) {
    return NextResponse.json({ updated: false }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const result = await updateOwnerPasswordWithIntent({
    token,
    password: body.password,
    operations: createOperations(admin),
  });

  const retryable = !result.ok && result.code === 'update_failed_retryable';
  if (!retryable) clearOwnerPasswordIntent();

  if (!result.ok) {
    const status = retryable ? 503 : result.code === 'invalid_intent' ? 401 : 409;
    return NextResponse.json(
      { updated: false, retryable },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { updated: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
