import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireManagerStore } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type ShiftStatus = Database['public']['Enums']['shift_status'];

type StoreRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type StaffRow = {
  id: string;
  name: string;
  employee_code: string | null;
  default_store_id: string | null;
};

type ShiftRow = {
  id: string;
  staff_id: string;
  work_date: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
  status: ShiftStatus;
  staff: {
    name: string;
    employee_code: string | null;
  } | null;
};

const statusLabels: Record<ShiftStatus, string> = {
  draft: '下書き',
  published: '公開済み',
  confirmed: '確認済み',
  completed: '完了',
  cancelled: '取消',
};

const statusVariants: Record<ShiftStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  published: 'default',
  confirmed: 'secondary',
  completed: 'secondary',
  cancelled: 'destructive',
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

function toTokyoTimestamp(date: string, time: string) {
  return `${date}T${time}:00+09:00`;
}

function formatTokyoTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function timeInputValue(value: string) {
  return formatTokyoTime(value);
}

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

async function getStoreStaff(organizationId: string, storeId: string, today: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: assignments }, { data: defaultStaff }] = await Promise.all([
    supabase
      .from('store_staff_assignments')
      .select('staff_id')
      .eq('organization_id', organizationId)
      .eq('store_id', storeId)
      .lte('starts_on', today)
      .or(`ends_on.is.null,ends_on.gte.${today}`),
    supabase
      .from('staff')
      .select('id, name, employee_code, default_store_id')
      .eq('organization_id', organizationId)
      .eq('default_store_id', storeId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  const assignmentStaffIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.staff_id)));
  const { data: assignedStaff } = assignmentStaffIds.length > 0
    ? await supabase
        .from('staff')
        .select('id, name, employee_code, default_store_id')
        .eq('organization_id', organizationId)
        .in('id', assignmentStaffIds)
        .eq('is_active', true)
        .order('name', { ascending: true })
    : { data: [] };

  const staffById = new Map<string, StaffRow>();
  [...((assignedStaff ?? []) as StaffRow[]), ...((defaultStaff ?? []) as StaffRow[])].forEach((staff) => {
    staffById.set(staff.id, staff);
  });

  return Array.from(staffById.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

async function createShift(formData: FormData) {
  'use server';

  const storeId = requiredText(formData.get('store_id'));
  const staffId = requiredText(formData.get('staff_id'));
  const workDate = requiredText(formData.get('work_date'));
  const startTime = requiredText(formData.get('start_time'));
  const endTime = requiredText(formData.get('end_time'));
  const breakMinutes = Number(requiredText(formData.get('break_minutes')) || 0);
  const status = requiredText(formData.get('status')) as ShiftStatus;

  if (!storeId || !staffId || !workDate || !startTime || !endTime || breakMinutes < 0) return;

  const context = await requireManagerStore(storeId);
  const supabase = createSupabaseAdminClient();

  await supabase
    .from('shifts')
    .insert({
      organization_id: context.profile.organization_id,
      store_id: storeId,
      staff_id: staffId,
      work_date: workDate,
      start_at: toTokyoTimestamp(workDate, startTime),
      end_at: toTokyoTimestamp(workDate, endTime),
      break_minutes: breakMinutes,
      status: ['draft', 'published'].includes(status) ? status : 'draft',
      created_by_user_id: context.user.id,
    });

  revalidatePath(`/manager/${storeId}/shifts`);
}

async function updateShift(formData: FormData) {
  'use server';

  const storeId = requiredText(formData.get('store_id'));
  const shiftId = requiredText(formData.get('shift_id'));
  const staffId = requiredText(formData.get('staff_id'));
  const workDate = requiredText(formData.get('work_date'));
  const startTime = requiredText(formData.get('start_time'));
  const endTime = requiredText(formData.get('end_time'));
  const breakMinutes = Number(requiredText(formData.get('break_minutes')) || 0);
  const status = requiredText(formData.get('status')) as ShiftStatus;

  if (!storeId || !shiftId || !staffId || !workDate || !startTime || !endTime || breakMinutes < 0) return;

  const context = await requireManagerStore(storeId);
  const supabase = createSupabaseAdminClient();

  await supabase
    .from('shifts')
    .update({
      staff_id: staffId,
      work_date: workDate,
      start_at: toTokyoTimestamp(workDate, startTime),
      end_at: toTokyoTimestamp(workDate, endTime),
      break_minutes: breakMinutes,
      status,
    })
    .eq('id', shiftId)
    .eq('store_id', storeId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath(`/manager/${storeId}/shifts`);
  revalidatePath(`/manager/${storeId}`);
}

async function setShiftStatus(formData: FormData) {
  'use server';

  const storeId = requiredText(formData.get('store_id'));
  const shiftId = requiredText(formData.get('shift_id'));
  const status = requiredText(formData.get('status')) as ShiftStatus;

  if (!storeId || !shiftId || !['published', 'cancelled'].includes(status)) return;

  const context = await requireManagerStore(storeId);
  const supabase = createSupabaseAdminClient();

  await supabase
    .from('shifts')
    .update({ status })
    .eq('id', shiftId)
    .eq('store_id', storeId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath(`/manager/${storeId}/shifts`);
}

export default async function ManagerShiftsPage({
  params,
}: {
  params: { storeId: string };
}) {
  const context = await requireManagerStore(params.storeId);
  const supabase = createSupabaseAdminClient();
  const today = getTokyoDateString();
  const rangeEnd = getTokyoDateString(addDays(new Date(), 31));

  const [{ data: store }, staff, { data: shifts }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name, is_active')
      .eq('id', params.storeId)
      .eq('organization_id', context.profile.organization_id)
      .maybeSingle<StoreRow>(),
    getStoreStaff(context.profile.organization_id, params.storeId, today),
    supabase
      .from('shifts')
      .select('id, staff_id, work_date, start_at, end_at, break_minutes, status, staff:staff_id (name, employee_code)')
      .eq('organization_id', context.profile.organization_id)
      .eq('store_id', params.storeId)
      .gte('work_date', today)
      .lte('work_date', rangeEnd)
      .order('work_date', { ascending: true })
      .order('start_at', { ascending: true }),
  ]);

  if (!store || !store.is_active) notFound();

  const rows = (shifts ?? []) as ShiftRow[];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">シフト管理</h1>
            <p className="mt-1 text-sm text-gray-600">{store.name} / 今後31日分</p>
          </div>
          <Link href={`/manager/${params.storeId}`}>
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>シフト作成</CardTitle>
            <CardDescription>下書きまたは公開済みとして作成できます。</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createShift} className="grid gap-4 md:grid-cols-7">
              <input type="hidden" name="store_id" value={params.storeId} />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-shift-staff">スタッフ</Label>
                <select
                  id="new-shift-staff"
                  name="staff_id"
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  required
                >
                  <option value="">選択してください</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-shift-date">日付</Label>
                <Input id="new-shift-date" name="work_date" type="date" defaultValue={today} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-shift-start">開始</Label>
                <Input id="new-shift-start" name="start_time" type="time" defaultValue="09:00" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-shift-end">終了</Label>
                <Input id="new-shift-end" name="end_time" type="time" defaultValue="18:00" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-shift-break">休憩分</Label>
                <Input id="new-shift-break" name="break_minutes" type="number" min="0" defaultValue="60" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-shift-status">状態</Label>
                <select
                  id="new-shift-status"
                  name="status"
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  defaultValue="draft"
                >
                  <option value="draft">下書き</option>
                  <option value="published">公開済み</option>
                </select>
              </div>
              <div className="md:col-span-7">
                <Button type="submit" disabled={staff.length === 0}>
                  シフトを作成
                </Button>
              </div>
            </form>
            {staff.length === 0 && <p className="mt-3 text-sm text-red-600">この店舗に所属中のスタッフがいません。</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>シフト一覧</CardTitle>
            <CardDescription>編集、公開、取消を行えます。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>スタッフ</TableHead>
                  <TableHead>日付</TableHead>
                  <TableHead>開始</TableHead>
                  <TableHead>終了</TableHead>
                  <TableHead>休憩</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <select
                        form={`shift-${shift.id}`}
                        name="staff_id"
                        defaultValue={shift.staff_id}
                        className="h-10 w-44 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                      >
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      {shift.staff?.employee_code && (
                        <div className="mt-1 text-xs text-gray-500">{shift.staff.employee_code}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input form={`shift-${shift.id}`} name="work_date" type="date" defaultValue={shift.work_date} required />
                    </TableCell>
                    <TableCell>
                      <Input form={`shift-${shift.id}`} name="start_time" type="time" defaultValue={timeInputValue(shift.start_at)} required />
                    </TableCell>
                    <TableCell>
                      <Input form={`shift-${shift.id}`} name="end_time" type="time" defaultValue={timeInputValue(shift.end_at)} required />
                    </TableCell>
                    <TableCell>
                      <Input form={`shift-${shift.id}`} name="break_minutes" type="number" min="0" defaultValue={shift.break_minutes} required />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant={statusVariants[shift.status]}>{statusLabels[shift.status]}</Badge>
                        <select
                          form={`shift-${shift.id}`}
                          name="status"
                          defaultValue={shift.status}
                          className="block h-9 w-28 rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <form id={`shift-${shift.id}`} action={updateShift}>
                          <input type="hidden" name="store_id" value={params.storeId} />
                          <input type="hidden" name="shift_id" value={shift.id} />
                          <Button type="submit" size="sm">保存</Button>
                        </form>
                        {shift.status === 'draft' && (
                          <form action={setShiftStatus}>
                            <input type="hidden" name="store_id" value={params.storeId} />
                            <input type="hidden" name="shift_id" value={shift.id} />
                            <input type="hidden" name="status" value="published" />
                            <Button type="submit" size="sm" variant="outline">公開</Button>
                          </form>
                        )}
                        {shift.status !== 'cancelled' && (
                          <form action={setShiftStatus}>
                            <input type="hidden" name="store_id" value={params.storeId} />
                            <input type="hidden" name="shift_id" value={shift.id} />
                            <input type="hidden" name="status" value="cancelled" />
                            <Button type="submit" size="sm" variant="destructive">取消</Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                      今後31日分のシフトはありません。
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
