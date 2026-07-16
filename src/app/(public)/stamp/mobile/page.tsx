import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { CorrectionRequestForm } from '@/components/stamp/CorrectionRequestForm';
import { MobileStampPanel } from '@/components/stamp/MobileStampPanel';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

type StoreRow = {
  id: string;
  name: string;
};

type StaffShiftRow = {
  id: string;
  work_date: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
  stores: {
    name: string;
  } | null;
};

type ShiftSubmissionWindowRow = {
  id: string;
  store_id: string | null;
  title: string;
  period_start: string;
  period_end: string;
  due_at: string;
};

type StaffSubmissionRow = {
  id: string;
  window_id: string;
  status: string;
  submitted_at: string | null;
  items: Array<{
    preferred_date: string;
    start_time: string | null;
    end_time: string | null;
    is_unavailable: boolean;
    note: string | null;
  }>;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  read_at: string | null;
  created_at: string;
};

function getTokyoDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatTokyoTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return '0分';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function toDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

async function submitShiftPreference(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['staff']);
  if (!context.staff) redirect('/login');

  const windowId = requiredText(formData.get('window_id'));
  const requestedSource = requiredText(formData.get('source'));
  if (!windowId) return;

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: window } = await supabase
    .from('shift_submission_windows')
    .select('id, organization_id, store_id, period_start, period_end, due_at, is_open')
    .eq('id', windowId)
    .eq('organization_id', context.profile.organization_id)
    .eq('is_open', true)
    .gte('due_at', now)
    .maybeSingle();

  if (!window) return;

  const targetStoreId = window.store_id;
  if (targetStoreId) {
    const [{ data: assignment }, { data: staff }] = await Promise.all([
      supabase
        .from('store_staff_assignments')
        .select('id')
        .eq('organization_id', context.profile.organization_id)
        .eq('store_id', targetStoreId)
        .eq('staff_id', context.staff.id)
        .lte('starts_on', window.period_end)
        .or(`ends_on.is.null,ends_on.gte.${window.period_start}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('staff')
        .select('default_store_id')
        .eq('id', context.staff.id)
        .eq('organization_id', context.profile.organization_id)
        .maybeSingle(),
    ]);

    if (!assignment && staff?.default_store_id !== targetStoreId) return;
  }

  const items = [0, 1, 2].flatMap((index) => {
    const preferredDate = requiredText(formData.get(`item_${index}_date`));
    const isUnavailable = formData.get(`item_${index}_unavailable`) === 'on';
    const startTime = requiredText(formData.get(`item_${index}_start`));
    const endTime = requiredText(formData.get(`item_${index}_end`));
    const note = requiredText(formData.get(`item_${index}_note`)) || null;

    if (!preferredDate) return [];
    if (!isUnavailable && (!startTime || !endTime)) return [];

    return [{
      organization_id: context.profile.organization_id,
      preferred_date: preferredDate,
      start_time: isUnavailable ? null : startTime,
      end_time: isUnavailable ? null : endTime,
      is_unavailable: isUnavailable,
      note,
    }];
  });

  if (items.length === 0) return;

  const { data: linkedLineAccount } = requestedSource === 'line'
    ? await supabase
        .from('line_accounts')
        .select('id')
        .eq('organization_id', context.profile.organization_id)
        .eq('staff_id', context.staff.id)
        .eq('status', 'linked')
        .maybeSingle()
    : { data: null };

  const { data: submission } = await supabase
    .from('shift_submissions')
    .upsert({
      organization_id: context.profile.organization_id,
      window_id: windowId,
      staff_id: context.staff.id,
      status: 'submitted',
      submitted_at: now,
      source: linkedLineAccount ? 'line' : 'mobile_web',
      line_account_id: linkedLineAccount?.id ?? null,
    }, { onConflict: 'window_id,staff_id' })
    .select('id')
    .single();

  if (!submission) return;

  await supabase
    .from('shift_submission_items')
    .delete()
    .eq('organization_id', context.profile.organization_id)
    .eq('submission_id', submission.id);

  await supabase
    .from('shift_submission_items')
    .insert(items.map((item) => ({
      ...item,
      submission_id: submission.id,
    })));

  revalidatePath('/stamp/mobile');
}

export default async function MobileStampPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const context = await requireAuthenticatedRole(['staff']);
  if (!context.staff) redirect('/login');
  const source = Array.isArray(searchParams.source) ? searchParams.source[0] : searchParams.source;
  const openedFromLine = source === 'line';

  const supabase = createSupabaseAdminClient();
  const today = getTokyoDateString();
  const rangeEnd = getTokyoDateString(addDays(new Date(), 14));

  const { data: assignments } = await supabase
    .from('store_staff_assignments')
    .select('store_id')
    .eq('staff_id', context.staff.id)
    .lte('starts_on', today)
    .or(`ends_on.is.null,ends_on.gte.${today}`);

  const storeIds = Array.from(new Set([
    ...(assignments ?? []).map((assignment) => assignment.store_id),
    ...(context.staff.default_store_id ? [context.staff.default_store_id] : []),
  ]));

  const { data: stores } = storeIds.length > 0
    ? await supabase
        .from('stores')
        .select('id, name')
        .in('id', storeIds)
        .eq('is_active', true)
        .order('name', { ascending: true })
    : { data: [] };

  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, work_date, start_at, end_at, break_minutes, stores:store_id (name)')
    .eq('organization_id', context.profile.organization_id)
    .eq('staff_id', context.staff.id)
    .in('status', ['published', 'confirmed'])
    .gte('work_date', today)
    .lte('work_date', rangeEnd)
    .order('work_date', { ascending: true })
    .order('start_at', { ascending: true });

  const shiftRows = (shifts ?? []) as StaffShiftRow[];

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, notification_type, read_at, created_at')
    .eq('organization_id', context.profile.organization_id)
    .eq('recipient_staff_id', context.staff.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const notificationRows = (notifications ?? []) as NotificationRow[];

  const { data: lineAccount } = await supabase
    .from('line_accounts')
    .select('id, display_name, linked_at')
    .eq('organization_id', context.profile.organization_id)
    .eq('staff_id', context.staff.id)
    .eq('status', 'linked')
    .maybeSingle();

  const { data: windows } = storeIds.length > 0
    ? await supabase
        .from('shift_submission_windows')
        .select('id, store_id, title, period_start, period_end, due_at')
        .eq('organization_id', context.profile.organization_id)
        .eq('is_open', true)
        .gte('due_at', new Date().toISOString())
        .in('store_id', storeIds)
        .order('due_at', { ascending: true })
    : { data: [] };

  const windowRows = (windows ?? []) as ShiftSubmissionWindowRow[];
  const windowIds = windowRows.map((window) => window.id);
  const { data: submissions } = windowIds.length > 0
    ? await supabase
        .from('shift_submissions')
        .select('id, window_id, status, submitted_at, items:shift_submission_items (preferred_date, start_time, end_time, is_unavailable, note)')
        .eq('organization_id', context.profile.organization_id)
        .eq('staff_id', context.staff.id)
        .in('window_id', windowIds)
    : { data: [] };

  const submissionsByWindowId = new Map(
    ((submissions ?? []) as StaffSubmissionRow[]).map((submission) => [submission.window_id, submission]),
  );

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">個人スマホ打刻</h1>
            <p className="mt-1 text-sm text-gray-600">GPSを取得して、出勤・退勤・休憩を記録します。</p>
          </div>
          <Link href="/stamp" className={buttonVariants({ variant: 'outline' })}>
            戻る
          </Link>
        </div>

        <div id="line-stamp" className="scroll-mt-6">
          <MobileStampPanel
            staffId={context.staff.id}
            staffName={context.profile.display_name}
            stores={(stores ?? []) as StoreRow[]}
            defaultStoreId={context.staff.default_store_id}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>LINE連携</CardTitle>
            <CardDescription>LINEからシフト確認、希望提出、GPS打刻ページへの移動ができます。</CardDescription>
          </CardHeader>
          <CardContent>
            {lineAccount ? (
              <p className="text-sm text-green-700">
                連携済み{lineAccount.display_name ? `: ${lineAccount.display_name}` : ''}
              </p>
            ) : (
              <p className="text-sm text-gray-600">未連携です。LINE公式アカウントで「連携」と送信してください。</p>
            )}
          </CardContent>
        </Card>

        <Card id="line-shift-submission" className="scroll-mt-6">
          <CardHeader>
            <CardTitle>通知</CardTitle>
            <CardDescription>申請結果、シフト公開、打刻漏れのお知らせを表示します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notificationRows.map((notification) => (
              <div key={notification.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{notification.title}</div>
                    <p className="mt-1 text-sm text-gray-600">{notification.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{toDateTimeLabel(notification.created_at)}</span>
                </div>
              </div>
            ))}
            {notificationRows.length === 0 && (
              <p className="text-sm text-gray-600">通知はありません。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今後のシフト</CardTitle>
            <CardDescription>公開済みのシフトを表示します。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日付</TableHead>
                  <TableHead>店舗</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>休憩</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftRows.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{shift.work_date}</TableCell>
                    <TableCell>{shift.stores?.name ?? '不明な店舗'}</TableCell>
                    <TableCell>{formatTokyoTime(shift.start_at)} - {formatTokyoTime(shift.end_at)}</TableCell>
                    <TableCell>{formatMinutes(shift.break_minutes)}</TableCell>
                  </TableRow>
                ))}
                {shiftRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                      今後14日分の公開シフトはありません。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>シフト希望提出</CardTitle>
            <CardDescription>受付中の募集に希望日、希望時間、不可日を提出します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {windowRows.map((window) => {
              const submission = submissionsByWindowId.get(window.id);
              return (
                <form key={window.id} action={submitShiftPreference} className="space-y-4 rounded-lg border p-4">
                  <input type="hidden" name="window_id" value={window.id} />
                  <input type="hidden" name="source" value={openedFromLine ? 'line' : 'mobile_web'} />
                  <div>
                    <h3 className="font-semibold">{window.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      対象: {window.period_start} - {window.period_end} / 締切: {toDateTimeLabel(window.due_at)}
                    </p>
                    {submission && (
                      <p className="mt-1 text-sm text-green-700">
                        提出済み: {submission.submitted_at ? toDateTimeLabel(submission.submitted_at) : '保存済み'}
                      </p>
                    )}
                  </div>

                  {[0, 1, 2].map((index) => {
                    const item = submission?.items[index];
                    return (
                      <div key={index} className="grid gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-5">
                        <div className="space-y-1">
                          <label className="text-sm font-medium" htmlFor={`item-${window.id}-${index}-date`}>希望日</label>
                          <input
                            id={`item-${window.id}-${index}-date`}
                            name={`item_${index}_date`}
                            type="date"
                            defaultValue={item?.preferred_date ?? ''}
                            className="h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium" htmlFor={`item-${window.id}-${index}-start`}>開始</label>
                          <input
                            id={`item-${window.id}-${index}-start`}
                            name={`item_${index}_start`}
                            type="time"
                            defaultValue={item?.start_time?.slice(0, 5) ?? ''}
                            className="h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium" htmlFor={`item-${window.id}-${index}-end`}>終了</label>
                          <input
                            id={`item-${window.id}-${index}-end`}
                            name={`item_${index}_end`}
                            type="time"
                            defaultValue={item?.end_time?.slice(0, 5) ?? ''}
                            className="h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        </div>
                        <label className="flex items-center gap-2 pt-7 text-sm">
                          <input name={`item_${index}_unavailable`} type="checkbox" defaultChecked={item?.is_unavailable ?? false} />
                          不可日
                        </label>
                        <div className="space-y-1">
                          <label className="text-sm font-medium" htmlFor={`item-${window.id}-${index}-note`}>メモ</label>
                          <input
                            id={`item-${window.id}-${index}-note`}
                            name={`item_${index}_note`}
                            defaultValue={item?.note ?? ''}
                            className="h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        </div>
                      </div>
                    );
                  })}

                  <Button type="submit">希望を提出</Button>
                </form>
              );
            })}
            {windowRows.length === 0 && (
              <p className="text-sm text-gray-600">受付中のシフト希望募集はありません。</p>
            )}
          </CardContent>
        </Card>

        <CorrectionRequestForm
          stores={(stores ?? []) as StoreRow[]}
          defaultStoreId={context.staff.default_store_id}
        />
      </div>
    </main>
  );
}
