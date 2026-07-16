import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { SessionActions } from '@/components/auth/SessionActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireManagerStore } from '@/lib/auth/session';
import { createStaffNotification } from '@/lib/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type AttendanceStatus = Database['public']['Enums']['attendance_status'];

type StoreRow = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

type ManagerPermissionRow = {
  store_id: string;
  stores: StoreRow | null;
};

type StaffRow = {
  id: string;
  name: string;
  employee_code: string | null;
  default_store_id: string | null;
};

type AttendanceRecordRow = {
  staff_id: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number;
  total_work_minutes: number;
  updated_at: string;
};

type DashboardRow = {
  staff: StaffRow;
  record: AttendanceRecordRow | null;
  status: AttendanceStatus;
};

const statusLabels: Record<AttendanceStatus, string> = {
  not_started: '未打刻',
  working: '出勤中',
  on_break: '休憩中',
  finished: '退勤済み',
};

const statusVariants: Record<AttendanceStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  not_started: 'destructive',
  working: 'default',
  on_break: 'outline',
  finished: 'secondary',
};

function getTokyoDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatTokyoTime(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function summarizeRows(rows: DashboardRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary[row.status] += 1;
      return summary;
    },
    {
      not_started: 0,
      working: 0,
      on_break: 0,
      finished: 0,
    } satisfies Record<AttendanceStatus, number>,
  );
}

async function createMissingAttendanceNotifications(formData: FormData) {
  'use server';

  const storeId = String(formData.get('store_id') ?? '');
  if (!storeId) return;

  const context = await requireManagerStore(storeId);
  const supabase = createSupabaseAdminClient();
  const today = getTokyoDateString();

  const [{ data: assignments }, { data: defaultStaff }, { data: records }] = await Promise.all([
    supabase
      .from('store_staff_assignments')
      .select('staff_id')
      .eq('organization_id', context.profile.organization_id)
      .eq('store_id', storeId)
      .lte('starts_on', today)
      .or(`ends_on.is.null,ends_on.gte.${today}`),
    supabase
      .from('staff')
      .select('id, name, employee_code, default_store_id')
      .eq('organization_id', context.profile.organization_id)
      .eq('default_store_id', storeId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('attendance_records')
      .select('staff_id, status, clock_in_at, clock_out_at')
      .eq('organization_id', context.profile.organization_id)
      .eq('store_id', storeId)
      .eq('work_date', today),
  ]);

  const assignmentStaffIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.staff_id)));
  const { data: assignedStaff } = assignmentStaffIds.length > 0
    ? await supabase
        .from('staff')
        .select('id, name, employee_code, default_store_id')
        .eq('organization_id', context.profile.organization_id)
        .in('id', assignmentStaffIds)
        .eq('is_active', true)
    : { data: [] };

  const staffById = new Map<string, StaffRow>();
  [...((assignedStaff ?? []) as StaffRow[]), ...((defaultStaff ?? []) as StaffRow[])].forEach((staff) => {
    staffById.set(staff.id, staff);
  });

  const recordByStaffId = new Map((records ?? []).map((record) => [record.staff_id, record]));
  const targets = Array.from(staffById.values()).flatMap((staff) => {
    const record = recordByStaffId.get(staff.id);
    if (!record) return [{ staff, title: '本日の打刻が未登録です', body: `${today} の出勤打刻が未登録です。` }];
    if (record.clock_in_at && !record.clock_out_at) return [{ staff, title: '本日の退勤打刻を確認してください', body: `${today} の退勤打刻が未登録です。` }];
    return [];
  });

  await Promise.all(targets.map((target) => createStaffNotification({
    organizationId: context.profile.organization_id,
    recipientStaffId: target.staff.id,
    title: target.title,
    body: target.body,
    notificationType: 'attendance_missing',
    relatedTable: 'attendance_records',
    relatedId: null,
  })));

  revalidatePath(`/manager/${storeId}`);
}

export default async function ManagerDashboardPage({
  params,
}: {
  params: { storeId: string };
}) {
  const context = await requireManagerStore(params.storeId);
  const supabase = createSupabaseAdminClient();
  const today = getTokyoDateString();

  const [{ data: store }, { data: permissions }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name, code, is_active')
      .eq('id', params.storeId)
      .eq('organization_id', context.profile.organization_id)
      .maybeSingle<StoreRow>(),
    supabase
      .from('manager_store_permissions')
      .select('store_id, stores:store_id (id, name, code, is_active)')
      .eq('user_id', context.user.id)
      .eq('organization_id', context.profile.organization_id),
  ]);

  if (!store || !store.is_active) notFound();

  const [{ data: assignments }, { data: defaultStaff }, { data: records }] = await Promise.all([
    supabase
      .from('store_staff_assignments')
      .select('staff_id')
      .eq('organization_id', context.profile.organization_id)
      .eq('store_id', store.id)
      .lte('starts_on', today)
      .or(`ends_on.is.null,ends_on.gte.${today}`),
    supabase
      .from('staff')
      .select('id, name, employee_code, default_store_id')
      .eq('organization_id', context.profile.organization_id)
      .eq('default_store_id', store.id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('attendance_records')
      .select('staff_id, status, clock_in_at, clock_out_at, break_minutes, total_work_minutes, updated_at')
      .eq('organization_id', context.profile.organization_id)
      .eq('store_id', store.id)
      .eq('work_date', today),
  ]);

  const assignmentStaffIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.staff_id)));
  const { data: assignedStaff } = assignmentStaffIds.length > 0
    ? await supabase
        .from('staff')
        .select('id, name, employee_code, default_store_id')
        .eq('organization_id', context.profile.organization_id)
        .in('id', assignmentStaffIds)
        .eq('is_active', true)
        .order('name', { ascending: true })
    : { data: [] };

  const staffById = new Map<string, StaffRow>();
  [...((assignedStaff ?? []) as StaffRow[]), ...((defaultStaff ?? []) as StaffRow[])].forEach((staff) => {
    staffById.set(staff.id, staff);
  });

  const recordByStaffId = new Map(
    ((records ?? []) as AttendanceRecordRow[]).map((record) => [record.staff_id, record]),
  );

  const rows = Array.from(staffById.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .map((staff): DashboardRow => {
      const record = recordByStaffId.get(staff.id) ?? null;
      return {
        staff,
        record,
        status: record?.status ?? 'not_started',
      };
    });

  const summary = summarizeRows(rows);
  const storeFilters = ((permissions ?? []) as ManagerPermissionRow[])
    .map((permission) => permission.stores)
    .filter((permissionStore): permissionStore is StoreRow => Boolean(permissionStore?.is_active))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">店長ダッシュボード</h1>
            <p className="mt-1 text-sm text-gray-600">
              {store.name} / {today} の勤怠状況
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/manager/${params.storeId}/requests`}
              className={buttonVariants({ variant: 'outline' })}
            >
              申請管理
            </Link>
            <Link
              href={`/manager/${params.storeId}/shifts`}
              className={buttonVariants({ variant: 'outline' })}
            >
              シフト管理
            </Link>
            <SessionActions />
          </div>
        </div>

        {storeFilters.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">担当店舗</CardTitle>
              <CardDescription>確認する店舗を切り替えます。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {storeFilters.map((filterStore) => (
                <Link
                  key={filterStore.id}
                  href={`/manager/${filterStore.id}`}
                  className={buttonVariants({
                    variant: filterStore.id === store.id ? 'default' : 'outline',
                    size: 'sm',
                  })}
                >
                  {filterStore.name}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {(Object.keys(statusLabels) as AttendanceStatus[]).map((status) => (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardDescription>{statusLabels[status]}</CardDescription>
                <CardTitle className="text-3xl">{summary[status]}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>今日の出勤状況</CardTitle>
            <CardDescription>未打刻と休憩中を先に確認できるよう、状態を一覧化しています。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createMissingAttendanceNotifications}>
              <input type="hidden" name="store_id" value={params.storeId} />
              <Button type="submit" variant="outline">打刻漏れ通知を作成</Button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>スタッフ</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>出勤</TableHead>
                  <TableHead>退勤</TableHead>
                  <TableHead>休憩</TableHead>
                  <TableHead>勤務</TableHead>
                  <TableHead>最終更新</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.staff.id}>
                    <TableCell>
                      <div className="font-medium">{row.staff.name}</div>
                      {row.staff.employee_code && (
                        <div className="text-xs text-gray-500">{row.staff.employee_code}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[row.status]}>{statusLabels[row.status]}</Badge>
                    </TableCell>
                    <TableCell>{formatTokyoTime(row.record?.clock_in_at ?? null)}</TableCell>
                    <TableCell>{formatTokyoTime(row.record?.clock_out_at ?? null)}</TableCell>
                    <TableCell>{formatMinutes(row.record?.break_minutes ?? 0)}</TableCell>
                    <TableCell>{formatMinutes(row.record?.total_work_minutes ?? 0)}</TableCell>
                    <TableCell>{formatTokyoTime(row.record?.updated_at ?? null)}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                      この店舗に所属中のスタッフがいません。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
