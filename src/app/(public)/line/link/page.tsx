import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentAuthContext } from '@/lib/auth/session';
import { hashLineLinkToken } from '@/lib/line/messaging';
import { createSupabaseAdminClient } from '@/lib/supabase';

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

async function linkLineAccount(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '').trim();
  if (!token) redirect('/line/link?status=invalid');

  const context = await getCurrentAuthContext();
  if (!context || context.profile.role !== 'staff' || !context.staff) {
    redirect(`/login?next=${encodeURIComponent(`/line/link?token=${token}`)}`);
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = hashLineLinkToken(token);
  const { data: linkToken } = await supabase
    .from('line_link_tokens')
    .select('id, organization_id, line_account_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .eq('organization_id', context.profile.organization_id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!linkToken) redirect('/line/link?status=expired');

  const { data: lineAccount } = await supabase
    .from('line_accounts')
    .select('id, staff_id, status')
    .eq('id', linkToken.line_account_id)
    .eq('organization_id', context.profile.organization_id)
    .maybeSingle();

  if (!lineAccount) redirect('/line/link?status=invalid');

  const { data: previousAccounts } = await supabase
    .from('line_accounts')
    .select('id, staff_id, status')
    .eq('organization_id', context.profile.organization_id)
    .eq('staff_id', context.staff.id)
    .neq('id', lineAccount.id);

  for (const previous of previousAccounts ?? []) {
    await supabase
      .from('line_accounts')
      .update({ staff_id: null, status: 'revoked', linked_at: null })
      .eq('id', previous.id);
  }

  const linkedAt = new Date().toISOString();
  const { error: accountError } = await supabase
    .from('line_accounts')
    .update({
      staff_id: context.staff.id,
      status: 'linked',
      linked_at: linkedAt,
      last_seen_at: linkedAt,
    })
    .eq('id', lineAccount.id)
    .eq('organization_id', context.profile.organization_id);

  if (accountError) redirect('/line/link?status=failed');

  const { error: tokenError } = await supabase
    .from('line_link_tokens')
    .update({ used_at: linkedAt })
    .eq('id', linkToken.id)
    .is('used_at', null);

  if (tokenError) redirect('/line/link?status=failed');

  await supabase.from('audit_logs').insert({
    organization_id: context.profile.organization_id,
    actor_user_id: context.user.id,
    action: 'line_account.linked',
    target_table: 'line_accounts',
    target_id: lineAccount.id,
    metadata: {
      before: {
        status: lineAccount.status,
        staff_id: lineAccount.staff_id,
      },
      after: {
        status: 'linked',
        staff_id: context.staff.id,
        linked_at: linkedAt,
      },
    },
  });

  redirect('/line/link?status=linked');
}

export default async function LineLinkPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const token = getParam(searchParams.token);
  const status = getParam(searchParams.status);
  const context = await getCurrentAuthContext();

  if (status === 'linked') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>LINE連携が完了しました</CardTitle>
            <CardDescription>LINEへ戻り、「シフト確認」や「打刻」と送信してください。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/stamp/mobile" className={buttonVariants({ className: 'w-full' })}>
              勤怠画面を開く
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const errorMessage = {
    expired: '連携URLの有効期限が切れています。LINEで「連携」と送信し、新しいURLを発行してください。',
    invalid: '連携URLが正しくありません。LINEで「連携」と送信し直してください。',
    failed: 'LINE連携を完了できませんでした。時間をおいて再度お試しください。',
  }[status];

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>LINEアカウント連携</CardTitle>
          <CardDescription>ログイン中のスタッフとLINEアカウントを安全に紐づけます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
          {!context && token && (
            <>
              <p className="text-sm text-gray-600">先にスタッフとしてログインしてください。ログイン後、この画面へ戻ります。</p>
              <Link
                href={`/login?next=${encodeURIComponent(`/line/link?token=${token}`)}`}
                className={buttonVariants({ className: 'w-full' })}
              >
                スタッフログイン
              </Link>
            </>
          )}
          {context?.profile.role === 'staff' && context.staff && token && (
            <form action={linkLineAccount}>
              <input type="hidden" name="token" value={token} />
              <p className="mb-4 text-sm text-gray-600">
                {context.profile.display_name} さんのスタッフアカウントへ連携します。
              </p>
              <Button type="submit" className="w-full">LINE連携を完了する</Button>
            </form>
          )}
          {context && context.profile.role !== 'staff' && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              スタッフアカウントでログインし直してください。
            </p>
          )}
          {!token && !errorMessage && (
            <p className="text-sm text-gray-600">LINEで「連携」と送信して、発行されたURLから開いてください。</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
