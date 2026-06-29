import { NextResponse } from 'next/server';

import {
  createLineLinkUrl,
  ensureLineAccount,
  getLineShiftSubmissionUrl,
  getLineStampUrl,
  isLineConfigured,
  replyLineText,
  verifyLineSignature,
  type LinkedLineAccount,
} from '@/lib/line/messaging';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    type?: string;
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

type ShiftRow = {
  work_date: string;
  start_at: string;
  end_at: string;
  stores: { name: string } | null;
};

function formatTokyoTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

async function buildShiftMessage(account: LinkedLineAccount) {
  if (!account.staff_id) return '先にスタッフアカウントとの連携を完了してください。';

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const end = new Date();
  end.setDate(end.getDate() + 14);
  const rangeEnd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(end);

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('shifts')
    .select('work_date, start_at, end_at, stores:store_id (name)')
    .eq('organization_id', account.organization_id)
    .eq('staff_id', account.staff_id)
    .in('status', ['published', 'confirmed'])
    .gte('work_date', today)
    .lte('work_date', rangeEnd)
    .order('work_date', { ascending: true })
    .order('start_at', { ascending: true })
    .limit(20);

  const shifts = (data ?? []) as ShiftRow[];
  if (shifts.length === 0) return '今後14日分の公開シフトはありません。';

  return [
    '今後14日分のシフト',
    ...shifts.map((shift) => (
      `${shift.work_date} ${formatTokyoTime(shift.start_at)}-${formatTokyoTime(shift.end_at)} ${shift.stores?.name ?? '店舗未設定'}`
    )),
  ].join('\n');
}

async function getLinkMessage(account: LinkedLineAccount) {
  if (account.status === 'linked' && account.staff_id) {
    return 'スタッフアカウントとの連携は完了しています。';
  }
  const url = await createLineLinkUrl(account);
  return `次のURLを15分以内に開き、勤怠アプリへログインして連携を完了してください。\n${url}`;
}

async function unlinkAccount(account: LinkedLineAccount) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('line_accounts')
    .update({
      staff_id: null,
      status: 'revoked',
      linked_at: null,
    })
    .eq('id', account.id)
    .eq('organization_id', account.organization_id);

  await supabase.from('audit_logs').insert({
    organization_id: account.organization_id,
    actor_line_account_id: account.id,
    action: 'line_account.revoked',
    target_table: 'line_accounts',
    target_id: account.id,
    metadata: {
      before: { status: account.status, staff_id: account.staff_id },
      after: { status: 'revoked', staff_id: null },
    },
  });
}

function menuMessage() {
  return [
    '勤怠管理メニュー',
    '・「連携」スタッフアカウントと連携',
    '・「シフト確認」今後14日分を表示',
    '・「シフト提出」希望提出ページを開く',
    '・「打刻」GPS打刻ページを開く',
    '・「連携解除」連携を解除',
  ].join('\n');
}

async function handleEvent(event: LineWebhookEvent) {
  const userId = event.source?.type === 'user' ? event.source.userId : null;
  const replyToken = event.replyToken;
  if (!userId || !replyToken) return;

  const account = await ensureLineAccount(userId);
  if (event.type === 'follow') {
    await replyLineText(replyToken, `${menuMessage()}\n\n${await getLinkMessage(account)}`);
    return;
  }
  if (event.type !== 'message' || event.message?.type !== 'text') return;

  const text = event.message.text?.trim().replace(/\s+/g, '') ?? '';
  if (['連携', 'アカウント連携'].includes(text)) {
    await replyLineText(replyToken, await getLinkMessage(account));
    return;
  }

  if (account.status !== 'linked' || !account.staff_id) {
    await replyLineText(replyToken, await getLinkMessage(account));
    return;
  }

  if (['シフト', 'シフト確認'].includes(text)) {
    await replyLineText(replyToken, await buildShiftMessage(account));
    return;
  }
  if (['シフト提出', '希望提出'].includes(text)) {
    await replyLineText(replyToken, `シフト希望はこちらから提出できます。\n${getLineShiftSubmissionUrl()}`);
    return;
  }
  if (['打刻', '出勤', '退勤', '休憩'].includes(text)) {
    await replyLineText(replyToken, `GPS確認付きの打刻ページを開いてください。\n${getLineStampUrl()}`);
    return;
  }
  if (text === '連携解除') {
    await unlinkAccount(account);
    await replyLineText(replyToken, 'スタッフアカウントとの連携を解除しました。');
    return;
  }

  await replyLineText(replyToken, menuMessage());
}

export async function POST(request: Request) {
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE integration is not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyLineSignature(rawBody, request.headers.get('x-line-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  await Promise.all((body.events ?? []).map(async (event) => {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error('LINE webhook event failed', error instanceof Error ? error.message : 'unknown error');
    }
  }));

  return NextResponse.json({ ok: true });
}
