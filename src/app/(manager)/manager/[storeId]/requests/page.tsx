import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireManagerStore } from '@/lib/auth/session';
import { createStaffNotification } from '@/lib/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type RequestStatus = Database['public']['Enums']['request_status'];
type AttendanceStatus = Database['public']['Enums']['attendance_status'];

type AttendanceRequestRow = {
  id: string;
  organization_id: string;
  store_id: string;
  staff_id: string;
  attendance_record_id: string | null;
  target_date: string;
  requested_clock_in_at: string | null;
  requested_clock_out_at: string | null;
  reason: string;
  status: RequestStatus;
  review_comment: string | null;
  created_at: string;
  staff: {
    name: string;
    employee_code: string | null;
  } | null;
};

type AttendanceRecordRow = {
  id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number;
  total_work_minutes: number;
  status: AttendanceStatus;
};

const statusLabels: Record<RequestStatus, string> = {
  pending: '未対応',
  approved: '承認済み',
  rejected: '却下',
  cancelled: '取消済み',
};

const statusVariants: Record<RequestStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'secondary',
};

function formatTokyoTime(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function calculateWorkMinutes(clockInAt: string | null, clockOutAt: string | null, breakMinutes: number) {
  if (!clockInAt || !clockOutAt) return 0;
  const diff = Math.floor((new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 60000);
  return Math.max(0, diff - breakMinutes);
}

function resolveStatus(clockInAt: string | null, clockOutAt: string | null): AttendanceStatus {
  if (clockOutAt) return 'finished';
  if (clockInAt) return 'working';
  return 'not_started';
}

async function reviewAttendanceRequest(formData: FormData) {
  'use server';

  const storeId = String(formData.get('store_id') ?? '');
  const requestId = String(formData.get('request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reviewComment = String(formData.get('review_comment') ?? '').trim() || null;

  if (!storeId || !requestId || !['approved', 'rejected'].includes(decision)) return;

  const context = await requireManagerStore(storeId);
  const supabase = createSupabaseAdminClient();

  const { data: request } = await supabase
    .from('attendance_requests')
    .select('id, organization_id, store_id, staff_id, attendance_record_id, target_date, requested_clock_in_at, requested_clock_out_at, reason, status')
    .eq('id', requestId)
    .eq('store_id', storeId)
    .eq('organization_id', context.profile.organization_id)
    .maybeSingle<Omit<AttendanceRequestRow, 'staff' | 'created_at' | 'review_comment'>>();

  if (!request || request.status !== 'pending') {
    revalidatePath(`/manager/${storeId}/requests`);
    return;
  }

  let attendanceRecordId = request.attendance_record_id;

  if (decision === 'approved') {
    const { data: existingRecord } = attendanceRecordId
      ? await supabase
          .from('attendance_records')
          .select('id, clock_in_at, clock_out_at, break_minutes, total_work_minutes, status')
          .eq('id', attendanceRecordId)
          .eq('organization_id', context.profile.organization_id)
          .maybeSingle<AttendanceRecordRow>()
      : await supabase
          .from('attendance_records')
          .select('id, clock_in_at, clock_out_at, break_minutes, total_work_minutes, status')
          .eq('organization_id', context.profile.organization_id)
          .eq('store_id', storeId)
          .eq('staff_id', request.staff_id)
          .eq('work_date', request.target_date)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle<AttendanceRecordRow>();

    const clockInAt = request.requested_clock_in_at ?? existingRecord?.clock_in_at ?? null;
    const clockOutAt = request.requested_clock_out_at ?? existingRecord?.clock_out_at ?? null;
    const breakMinutes = existingRecord?.break_minutes ?? 0;
    const totalWorkMinutes = calculateWorkMinutes(clockInAt, clockOutAt, breakMinutes);
    const status = resolveStatus(clockInAt, clockOutAt);

    if (existingRecord) {
      await supabase
        .from('attendance_records')
        .update({
          clock_in_at: clockInAt,
          clock_out_at: clockOutAt,
          break_minutes: breakMinutes,
          total_work_minutes: totalWorkMinutes,
          status,
          is_manual: true,
          note: reviewComment ?? '打刻修正申請を承認',
        })
        .eq('id', existingRecord.id)
        .eq('organization_id', context.profile.organization_id);
      attendanceRecordId = existingRecord.id;
    } else {
      const { data: insertedRecord } = await supabase
        .from('attendance_records')
        .insert({
          organization_id: context.profile.organization_id,
          store_id: storeId,
          staff_id: request.staff_id,
          work_date: request.target_date,
          status,
          clock_in_at: clockInAt,
          clock_out_at: clockOutAt,
          break_minutes: breakMinutes,
          total_work_minutes: totalWorkMinutes,
          night_shift_minutes: 0,
          is_manual: true,
          note: reviewComment ?? '打刻修正申請を承認',
        })
        .select('id')
        .single();
      attendanceRecordId = insertedRecord?.id ?? null;
    }
  }

  await supabase
    .from('attendance_requests')
    .update({
      attendance_record_id: attendanceRecordId,
      status: decision as RequestStatus,
      reviewed_by_user_id: context.user.id,
      reviewed_at: new Date().toISOString(),
      review_comment: reviewComment,
    })
    .eq('id', request.id)
    .eq('organization_id', context.profile.organization_id);

  await supabase
    .from('audit_logs')
    .insert({
      organization_id: context.profile.organization_id,
      actor_user_id: context.user.id,
      action: decision === 'approved' ? 'attendance_request.approved' : 'attendance_request.rejected',
      target_table: 'attendance_requests',
      target_id: request.id,
      metadata: {
        store_id: storeId,
        staff_id: request.staff_id,
        target_date: request.target_date,
        attendance_record_id: attendanceRecordId,
      },
    });

  await createStaffNotification({
    organizationId: context.profile.organization_id,
    recipientStaffId: request.staff_id,
    title: decision === 'approved' ? '打刻修正申請が承認されました' : '打刻修正申請が却下されました',
    body: `${request.target_date} の打刻修正申請が${decision === 'approved' ? '承認' : '却下'}されました。`,
    notificationType: decision === 'approved' ? 'attendance_request_approved' : 'attendance_request_rejected',
    relatedTable: 'attendance_requests',
    relatedId: request.id,
  });

  revalidatePath(`/manager/${storeId}/requests`);
  revalidatePath(`/manager/${storeId}`);
}

export default async function ManagerRequestsPage({
  params,
}: {
  params: { storeId: string };
}) {
  const context = await requireManagerStore(params.storeId);
  const supabase = createSupabaseAdminClient();

  const { data: requests } = await supabase
    .from('attendance_requests')
    .select('id, organization_id, store_id, staff_id, attendance_record_id, target_date, requested_clock_in_at, requested_clock_out_at, reason, status, review_comment, created_at, staff:staff_id (name, employee_code)')
    .eq('organization_id', context.profile.organization_id)
    .eq('store_id', params.storeId)
    .eq('request_type', 'attendance_correction')
    .order('status', { ascending: false })
    .order('target_date', { ascending: false })
    .order('created_at', { ascending: false });

  const rows = ((requests ?? []) as AttendanceRequestRow[]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">申請管理</h1>
          <Link href={`/manager/${params.storeId}`}>
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>打刻修正申請</CardTitle>
            <CardDescription>承認すると対象日の勤怠レコードへ反映されます。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>スタッフ</TableHead>
                  <TableHead>対象日</TableHead>
                  <TableHead>修正時刻</TableHead>
                  <TableHead>理由</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>コメント</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{request.staff?.name ?? '不明なスタッフ'}</div>
                      {request.staff?.employee_code && (
                        <div className="text-xs text-gray-500">{request.staff.employee_code}</div>
                      )}
                    </TableCell>
                    <TableCell>{request.target_date}</TableCell>
                    <TableCell>
                      <div className="text-sm">出勤: {formatTokyoTime(request.requested_clock_in_at)}</div>
                      <div className="text-sm">退勤: {formatTokyoTime(request.requested_clock_out_at)}</div>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-sm">{request.reason}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[request.status]}>{statusLabels[request.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === 'pending' ? (
                        <Input form={`review-${request.id}`} name="review_comment" placeholder="任意" />
                      ) : (
                        <span className="text-sm text-gray-600">{request.review_comment ?? '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === 'pending' && (
                        <form id={`review-${request.id}`} action={reviewAttendanceRequest} className="flex justify-end gap-2">
                          <input type="hidden" name="store_id" value={params.storeId} />
                          <input type="hidden" name="request_id" value={request.id} />
                          <Button type="submit" name="decision" value="approved" size="sm">
                            承認
                          </Button>
                          <Button type="submit" name="decision" value="rejected" size="sm" variant="destructive">
                            却下
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                      打刻修正申請はありません。
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
