import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthenticatedRole } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

const requestSchema = z.object({
  store_id: z.string().uuid(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requested_clock_in_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  requested_clock_out_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  reason: z.string().trim().min(1).max(1000),
});

function toTokyoTimestamp(date: string, time?: string | null) {
  if (!time) return null;
  return `${date}T${time}:00+09:00`;
}

export async function POST(request: Request) {
  const context = await requireAuthenticatedRole(['staff']);
  if (!context.staff) {
    return NextResponse.json({ error: { message: 'スタッフ情報が見つかりません' } }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: '申請内容を確認してください' } }, { status: 400 });
  }

  const {
    store_id: storeId,
    target_date: targetDate,
    requested_clock_in_time: requestedClockInTime,
    requested_clock_out_time: requestedClockOutTime,
    reason,
  } = parsed.data;

  if (!requestedClockInTime && !requestedClockOutTime) {
    return NextResponse.json({ error: { message: '修正する時刻を入力してください' } }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, organization_id, is_active')
    .eq('id', storeId)
    .eq('organization_id', context.profile.organization_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: { message: '店舗が見つかりません' } }, { status: 404 });
  }

  const [{ data: assignment }, { data: staff }] = await Promise.all([
    supabase
      .from('store_staff_assignments')
      .select('id')
      .eq('organization_id', context.profile.organization_id)
      .eq('store_id', storeId)
      .eq('staff_id', context.staff.id)
      .lte('starts_on', targetDate)
      .or(`ends_on.is.null,ends_on.gte.${targetDate}`)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('staff')
      .select('id, default_store_id, is_active')
      .eq('id', context.staff.id)
      .eq('organization_id', context.profile.organization_id)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (!staff || (!assignment && staff.default_store_id !== storeId)) {
    return NextResponse.json({ error: { message: 'この店舗への申請権限がありません' } }, { status: 403 });
  }

  const { data: record } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('organization_id', context.profile.organization_id)
    .eq('store_id', storeId)
    .eq('staff_id', context.staff.id)
    .eq('work_date', targetDate)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from('attendance_requests')
    .insert({
      organization_id: context.profile.organization_id,
      store_id: storeId,
      staff_id: context.staff.id,
      attendance_record_id: record?.id ?? null,
      request_type: 'attendance_correction',
      target_date: targetDate,
      requested_clock_in_at: toTokyoTimestamp(targetDate, requestedClockInTime),
      requested_clock_out_at: toTokyoTimestamp(targetDate, requestedClockOutTime),
      reason,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: { message: '申請の保存に失敗しました' } }, { status: 500 });
  }

  return NextResponse.json({ request_id: created.id }, { status: 201 });
}
