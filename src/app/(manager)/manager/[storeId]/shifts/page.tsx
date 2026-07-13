import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireManagerStore } from '@/lib/auth/session';
import { createStaffNotification } from '@/lib/notifications';
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

type ShiftSubmissionWindowRow = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  due_at: string;
  is_open: boolean;
  created_at: string;
};

type ShiftSubmissionRow = {
  id: string;
  window_id: string;
  staff_id: string;
  status: Database['public']['Enums']['shift_submission_status'];
  submitted_at: string | null;
  staff: {
    name: string;
    employee_code: string | null;
  } | null;
  items: Array<{
    preferred_date: string;
    start_time: string | null;
    end_time: string | null;
    is_unavailable: boolean;
    note: string | null;
  }>;
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

function toTokyoDueTimestamp(date: string, time: string) {
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

function formatDateTime(value: string) {
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

  const shiftStatus = ['draft', 'published'].includes(status) ? status : 'draft';
  const { data: insertedShift } = await supabase
    .from('shifts')
    .insert({
      organization_id: context.profile.organization_id,
      store_id: storeId,
      staff_id: staffId,
      work_date: workDate,
      start_at: toTokyoTimestamp(workDate, startTime),
      end_at: toTokyoTimestamp(workDate, endTime),
      break_minutes: breakMinutes,
      status: shiftStatus,
      created_by_user_id: context.user.id,
    })
    .select('id')
    .single();

  if (shiftStatus === 'published' && insertedShift) {
    await createStaffNotification({
      organizationId: context.profile.organization_id,
      recipientStaffId: staffId,
      title: 'シフトが公開されました',
      body: `${workDate} のシフトが公開されました。`,
      notificationType: 'shift_published',
      relatedTable: 'shifts',
      relatedId: insertedShift.id,
    });
  }

  revalidatePath(`/manager/${storeId}/shifts`);
}

async function createSubmissionWindow(formData: FormData) {
  'use server';

  const storeId = requiredText(formData.get('store_id'));
  const title = requiredText(formData.get('title'));
  const periodStart = requiredText(formData.get('period_start'));
  const periodEnd = requiredText(formData.get('period_end'));
  const dueDate = requiredText(formData.get('due_date'));
  const dueTime = requiredText(formData.get('due_time')) || '23:59';

  if (!storeId || !title || !periodStart || !periodEnd || !dueDate) return;

  const context = await requireManagerStore(storeId);
  const supabase = createSupabaseAdminClient();

  await supabase
    .from('shift_submission_windows')
    .insert({
      organization_id: context.profile.organization_id,
      store_id: storeId,
      title,
      period_start: periodStart,
      period_end: periodEnd,
      due_at: toTokyoDueTimestamp(dueDate, dueTime),
      is_open: true,
      created_by_user_id: context.user.id,
    });

  revalidatePath(`/manager/${storeId}/shifts`);
}

async function setSubmissionWindowOpen(formData: FormData) {
  'use server';

  const storeId = requiredText(formData.get('store_id'));
  const windowId = requiredText(formData.get('window_id'));
  const isOpen = requiredText(formData.get('is_open')) === 'true';

  if (!storeId || !windowId) return;

  const context = await requireManagerStore(storeId);
  const supabase = createSupabaseAdminClient();

  await supabase
    .from('shift_submission_windows')
    .update({ is_open: isOpen })
    .eq('id', windowId)
    .eq('organization_id', context.profile.organization_id)
    .eq('store_id', storeId);

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

  if (status === 'published') {
    const { data: shift } = await supabase
      .from('shifts')
      .select('id, staff_id, work_date, start_at, end_at')
      .eq('id', shiftId)
      .eq('store_id', storeId)
      .eq('organization_id', context.profile.organization_id)
      .maybeSingle();

    if (shift) {
      await createStaffNotification({
        organizationId: context.profile.organization_id,
        recipientStaffId: shift.staff_id,
        title: 'シフトが公開されました',
        body: `${shift.work_date} のシフトが公開されました。`,
        notificationType: 'shift_published',
        relatedTable: 'shifts',
        relatedId: shift.id,
      });
    }
  }

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

  const [{ data: store }, staff, { data: shifts }, { data: windows }, { data: submissions }] = await Promise.all([
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
    supabase
      .from('shift_submission_windows')
      .select('id, title, period_start, period_end, due_at, is_open, created_at')
      .eq('organization_id', context.profile.organization_id)
      .eq('store_id', params.storeId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('shift_submissions')
      .select('id, window_id, staff_id, status, submitted_at, staff:staff_id (name, employee_code), items:shift_submission_items (preferred_date, start_time, end_time, is_unavailable, note)')
      .eq('organization_id', context.profile.organization_id)
      .order('submitted_at', { ascending: false }),
  ]);

  if (!store || !store.is_active) notFound();

  const rows = (shifts ?? []) as ShiftRow[];
  const windowRows = (windows ?? []) as ShiftSubmissionWindowRow[];
  const windowIds = new Set(windowRows.map((window) => window.id));
  const submissionRows = ((submissions ?? []) as ShiftSubmissionRow[]).filter((submission) => windowIds.has(submission.window_id));
  const submissionsByWindowId = submissionRows.reduce<Record<string, ShiftSubmissionRow[]>>((grouped, submission) => {
    grouped[submission.window_id] = [...(grouped[submission.window_id] ?? []), submission];
    return grouped;
  }, {});

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">シフト管理</h1>
            <p className="mt-1 text-sm text-gray-600">{store.name} / 今後31日分</p>
          </div>
          <Link
            href={`/manager/${params.storeId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            戻る
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>シフト希望募集</CardTitle>
            <CardDescription>スタッフが希望を提出する期間を作成します。</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createSubmissionWindow} className="grid gap-4 md:grid-cols-6">
              <input type="hidden" name="store_id" value={params.storeId} />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-window-title">募集名</Label>
                <Input id="new-window-title" name="title" placeholder="7月前半シフト希望" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-window-start">対象開始</Label>
                <Input id="new-window-start" name="period_start" type="date" defaultValue={today} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-window-end">対象終了</Label>
                <Input id="new-window-end" name="period_end" type="date" defaultValue={rangeEnd} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-window-due-date">締切日</Label>
                <Input id="new-window-due-date" name="due_date" type="date" defaultValue={today} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-window-due-time">締切時刻</Label>
                <Input id="new-window-due-time" name="due_time" type="time" defaultValue="23:59" required />
              </div>
              <div className="md:col-span-6">
                <Button type="submit">募集期間を作成</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>提出状況</CardTitle>
            <CardDescription>募集ごとの提出状況と希望内容を確認します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {windowRows.map((window) => {
              const windowSubmissions = submissionsByWindowId[window.id] ?? [];
              return (
                <div key={window.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{window.title}</h3>
                        <Badge variant={window.is_open ? 'default' : 'secondary'}>
                          {window.is_open ? '受付中' : '締切'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        対象: {window.period_start} - {window.period_end} / 締切: {formatDateTime(window.due_at)}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        提出: {windowSubmissions.length} / {staff.length}
                      </p>
                    </div>
                    <form action={setSubmissionWindowOpen}>
                      <input type="hidden" name="store_id" value={params.storeId} />
                      <input type="hidden" name="window_id" value={window.id} />
                      <input type="hidden" name="is_open" value={window.is_open ? 'false' : 'true'} />
                      <Button type="submit" size="sm" variant="outline">
                        {window.is_open ? '締め切る' : '再開する'}
                      </Button>
                    </form>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>スタッフ</TableHead>
                        <TableHead>状態</TableHead>
                        <TableHead>希望内容</TableHead>
                        <TableHead>提出日時</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {windowSubmissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell>
                            <div className="font-medium">{submission.staff?.name ?? '不明なスタッフ'}</div>
                            {submission.staff?.employee_code && (
                              <div className="text-xs text-gray-500">{submission.staff.employee_code}</div>
                            )}
                          </TableCell>
                          <TableCell>{submission.status === 'submitted' ? '提出済み' : submission.status}</TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1 text-sm">
                              {submission.items.map((item) => (
                                <div key={`${submission.id}-${item.preferred_date}-${item.start_time ?? 'none'}`}>
                                  {item.preferred_date}: {item.is_unavailable ? '不可' : `${item.start_time?.slice(0, 5)}-${item.end_time?.slice(0, 5)}`}
                                  {item.note ? ` / ${item.note}` : ''}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{submission.submitted_at ? formatDateTime(submission.submitted_at) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      {windowSubmissions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-gray-500">
                            まだ提出がありません。
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
            {windowRows.length === 0 && (
              <p className="text-sm text-gray-600">シフト希望募集はまだありません。</p>
            )}
          </CardContent>
        </Card>

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
