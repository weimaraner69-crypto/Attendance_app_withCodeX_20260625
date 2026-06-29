import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { createSupabaseAdminClient } from '@/lib/supabase';

const LINE_API_BASE_URL = 'https://api.line.me/v2/bot';
const LINK_TOKEN_TTL_MINUTES = 15;

type LineTextMessage = {
  type: 'text';
  text: string;
};

type LineProfile = {
  displayName?: string;
  pictureUrl?: string;
};

export type LinkedLineAccount = {
  id: string;
  organization_id: string;
  staff_id: string | null;
  line_user_id: string;
  status: 'pending' | 'linked' | 'blocked' | 'revoked';
};

function getRequiredLineEnv(name: 'LINE_CHANNEL_SECRET' | 'LINE_CHANNEL_ACCESS_TOKEN' | 'LINE_ORGANIZATION_ID' | 'NEXT_PUBLIC_APP_URL') {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function isLineConfigured() {
  return Boolean(
    process.env.LINE_CHANNEL_SECRET?.trim()
    && process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim()
    && process.env.LINE_ORGANIZATION_ID?.trim()
    && process.env.NEXT_PUBLIC_APP_URL?.trim(),
  );
}

export function verifyLineSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const secret = getRequiredLineEnv('LINE_CHANNEL_SECRET');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length
    && timingSafeEqual(expectedBuffer, signatureBuffer);
}

function getAppUrl(path: string) {
  const origin = getRequiredLineEnv('NEXT_PUBLIC_APP_URL').replace(/\/+$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

async function requestLine(path: string, init: RequestInit) {
  const token = getRequiredLineEnv('LINE_CHANNEL_ACCESS_TOKEN');
  const response = await fetch(`${LINE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`LINE Messaging API request failed (${response.status})`);
  }
}

export async function replyLineText(replyToken: string, text: string) {
  await requestLine('/message/reply', {
    method: 'POST',
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text } satisfies LineTextMessage],
    }),
  });
}

export async function pushLineText(lineUserId: string, text: string) {
  await requestLine('/message/push', {
    method: 'POST',
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text } satisfies LineTextMessage],
    }),
  });
}

export async function getLineProfile(lineUserId: string): Promise<LineProfile | null> {
  const token = getRequiredLineEnv('LINE_CHANNEL_ACCESS_TOKEN');
  const response = await fetch(`${LINE_API_BASE_URL}/profile/${encodeURIComponent(lineUserId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json() as Promise<LineProfile>;
}

export async function ensureLineAccount(lineUserId: string) {
  const organizationId = getRequiredLineEnv('LINE_ORGANIZATION_ID');
  const supabase = createSupabaseAdminClient();
  const profile = await getLineProfile(lineUserId);
  const { data: existing } = await supabase
    .from('line_accounts')
    .select('id, organization_id, staff_id, line_user_id, status')
    .eq('line_user_id', lineUserId)
    .maybeSingle<LinkedLineAccount>();

  if (existing) {
    if (existing.organization_id !== organizationId) {
      throw new Error('LINE account belongs to a different organization');
    }
    await supabase
      .from('line_accounts')
      .update({
        display_name: profile?.displayName ?? null,
        picture_url: profile?.pictureUrl ?? null,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return existing;
  }

  const { data, error } = await supabase
    .from('line_accounts')
    .insert({
      organization_id: organizationId,
      line_user_id: lineUserId,
      display_name: profile?.displayName ?? null,
      picture_url: profile?.pictureUrl ?? null,
      status: 'pending',
      last_seen_at: new Date().toISOString(),
    })
    .select('id, organization_id, staff_id, line_user_id, status')
    .single<LinkedLineAccount>();

  if (error || !data) throw new Error('Failed to create LINE account');
  return data;
}

export async function createLineLinkUrl(account: LinkedLineAccount) {
  const supabase = createSupabaseAdminClient();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MINUTES * 60_000).toISOString();

  await supabase
    .from('line_link_tokens')
    .update({ used_at: now })
    .eq('line_account_id', account.id)
    .is('used_at', null);

  const { error } = await supabase.from('line_link_tokens').insert({
    organization_id: account.organization_id,
    line_account_id: account.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) throw new Error('Failed to create LINE link token');

  return getAppUrl(`/line/link?token=${encodeURIComponent(token)}`);
}

export function getLineStampUrl() {
  return getAppUrl('/stamp/mobile?source=line#line-stamp');
}

export function getLineShiftSubmissionUrl() {
  return getAppUrl('/stamp/mobile?source=line#line-shift-submission');
}

export function hashLineLinkToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
