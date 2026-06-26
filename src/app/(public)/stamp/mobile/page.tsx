import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CorrectionRequestForm } from '@/components/stamp/CorrectionRequestForm';
import { MobileStampPanel } from '@/components/stamp/MobileStampPanel';
import { Button } from '@/components/ui/button';
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

export default async function MobileStampPage() {
  const context = await requireAuthenticatedRole(['staff']);
  if (!context.staff) redirect('/login');

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

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">個人スマホ打刻</h1>
            <p className="mt-1 text-sm text-gray-600">GPSを取得して、出勤・退勤・休憩を記録します。</p>
          </div>
          <Link href="/stamp">
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <MobileStampPanel
          staffId={context.staff.id}
          staffName={context.profile.display_name}
          stores={(stores ?? []) as StoreRow[]}
          defaultStoreId={context.staff.default_store_id}
        />

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

        <CorrectionRequestForm
          stores={(stores ?? []) as StoreRow[]}
          defaultStoreId={context.staff.default_store_id}
        />
      </div>
    </main>
  );
}
