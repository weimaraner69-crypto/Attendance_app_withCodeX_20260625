import { getDistance } from '@/lib/utils/gpsUtils';
import { verifyPin } from '@/lib/auth/pin';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { calculateRecordPatch, minutesBetween } from './stamp-state';

type AttendanceEventType = Database['public']['Enums']['attendance_event_type'];
type AttendanceSource = Database['public']['Enums']['attendance_source'];
type AttendanceStatus = Database['public']['Enums']['attendance_status'];

type StampPayload = {
  store_id: string;
  staff_id: string;
  event_type: AttendanceEventType;
  source: Extract<AttendanceSource, 'kiosk' | 'mobile_web'>;
  occurred_at?: string;
  pin?: string;
  kiosk_device_id?: string;
  latitude?: number;
  longitude?: number;
  gps_accuracy_meters?: number;
  note?: string;
};

type StampResult =
  | {
      ok: true;
      record: {
        id: string;
        status: AttendanceStatus;
        work_date: string;
        clock_in_at: string | null;
        clock_out_at: string | null;
        break_minutes: number;
        total_work_minutes: number;
      };
      event: {
        id: string;
        event_type: AttendanceEventType;
        occurred_at: string;
      };
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

type StaffRow = {
  id: string;
  organization_id: string;
  auth_user_id: string | null;
  name: string;
  pin_hash: string | null;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
  is_active: boolean;
};

type StoreRow = {
  id: string;
  organization_id: string;
  latitude: number | null;
  longitude: number | null;
  gps_radius_meters: number;
  is_active: boolean;
};

type AttendanceRecordRow = {
  id: string;
  organization_id: string;
  store_id: string;
  staff_id: string;
  work_date: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number;
  total_work_minutes: number;
  night_shift_minutes: number;
  is_manual: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function stampError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): StampResult {
  return { ok: false, status, code, message, details };
}

function getTokyoDate(occurredAt: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(occurredAt);
}

async function getCurrentAuthUserId() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function stampAttendance(payload: StampPayload): Promise<StampResult> {
  const supabase = createSupabaseAdminClient();
  const occurredAtDate = payload.occurred_at ? new Date(payload.occurred_at) : new Date();

  if (Number.isNaN(occurredAtDate.getTime())) {
    return stampError(400, 'INVALID_OCCURRED_AT', '打刻時刻が不正です');
  }

  const occurredAt = occurredAtDate.toISOString();
  const workDate = getTokyoDate(occurredAtDate);

  const [{ data: store, error: storeError }, { data: staff, error: staffError }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, organization_id, latitude, longitude, gps_radius_meters, is_active')
      .eq('id', payload.store_id)
      .maybeSingle<StoreRow>(),
    supabase
      .from('staff')
      .select('id, organization_id, auth_user_id, name, pin_hash, pin_failed_attempts, pin_locked_until, is_active')
      .eq('id', payload.staff_id)
      .maybeSingle<StaffRow>(),
  ]);

  if (storeError || staffError) {
    return stampError(500, 'INTERNAL_ERROR', '打刻対象の確認に失敗しました');
  }
  if (!store || !store.is_active) {
    return stampError(404, 'STORE_NOT_FOUND', '有効な店舗が見つかりません');
  }
  if (!staff || !staff.is_active || staff.organization_id !== store.organization_id) {
    return stampError(404, 'STAFF_NOT_FOUND', '有効なスタッフが見つかりません');
  }

  let authUserId: string | null = null;
  let kioskDeviceId: string | null = null;
  let pinVerifiedAt: string | null = null;
  let gpsVerified: boolean | null = null;
  let distanceFromStoreMeters: number | null = null;

  if (payload.source === 'kiosk') {
    if (!payload.kiosk_device_id) {
      return stampError(400, 'KIOSK_DEVICE_REQUIRED', '店舗iPad端末IDが必要です');
    }
    if (!payload.pin) {
      return stampError(400, 'PIN_REQUIRED', 'PINが必要です');
    }
    if (staff.pin_locked_until && Date.parse(staff.pin_locked_until) > Date.now()) {
      return stampError(403, 'PIN_LOCKED', 'PINがロックされています');
    }

    const { data: kioskDevice } = await supabase
      .from('kiosk_devices')
      .select('id, store_id, is_active')
      .eq('id', payload.kiosk_device_id)
      .eq('organization_id', store.organization_id)
      .maybeSingle();

    if (!kioskDevice || !kioskDevice.is_active || kioskDevice.store_id !== store.id) {
      return stampError(403, 'INVALID_KIOSK_DEVICE', '店舗iPad端末が無効です');
    }

    if (!verifyPin(payload.pin, staff.pin_hash)) {
      const failedAttempts = staff.pin_failed_attempts + 1;
      await supabase
        .from('staff')
        .update({
          pin_failed_attempts: failedAttempts,
          pin_locked_until: failedAttempts >= 5 ? new Date(Date.now() + 10 * 60_000).toISOString() : null,
        })
        .eq('id', staff.id);

      return stampError(403, 'INVALID_PIN', 'PINが違います');
    }

    await supabase
      .from('staff')
      .update({ pin_failed_attempts: 0, pin_locked_until: null })
      .eq('id', staff.id);

    kioskDeviceId = kioskDevice.id;
    pinVerifiedAt = occurredAt;
  }

  if (payload.source === 'mobile_web') {
    authUserId = await getCurrentAuthUserId();
    if (!authUserId || staff.auth_user_id !== authUserId) {
      return stampError(401, 'UNAUTHENTICATED', 'スタッフ本人のログインが必要です');
    }

    if (
      typeof payload.latitude !== 'number' ||
      typeof payload.longitude !== 'number' ||
      store.latitude == null ||
      store.longitude == null
    ) {
      return stampError(400, 'GPS_REQUIRED', 'GPS情報と店舗座標が必要です');
    }

    distanceFromStoreMeters = getDistance(
      payload.latitude,
      payload.longitude,
      store.latitude,
      store.longitude
    );
    gpsVerified = distanceFromStoreMeters <= store.gps_radius_meters;

    if (!gpsVerified) {
      return stampError(403, 'GPS_OUT_OF_RANGE', '店舗の打刻許可範囲外です', {
        distance_from_store_meters: Math.round(distanceFromStoreMeters),
        gps_radius_meters: store.gps_radius_meters,
      });
    }
  }

  const { data: existingRecord, error: existingRecordError } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('staff_id', staff.id)
    .eq('work_date', workDate)
    .maybeSingle<AttendanceRecordRow>();

  if (existingRecordError) {
    return stampError(500, 'INTERNAL_ERROR', '勤怠記録の取得に失敗しました');
  }

  let additionalBreakMinutes = 0;
  if (payload.event_type === 'break_end' && existingRecord) {
    const { data: latestBreakStart } = await supabase
      .from('attendance_events')
      .select('occurred_at')
      .eq('attendance_record_id', existingRecord.id)
      .eq('event_type', 'break_start')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    additionalBreakMinutes = latestBreakStart?.occurred_at
      ? minutesBetween(latestBreakStart.occurred_at, occurredAt)
      : 0;
  }

  const patch = calculateRecordPatch(existingRecord, payload.event_type, occurredAt, additionalBreakMinutes);
  if ('ok' in patch) return patch;

  let record: AttendanceRecordRow | null = null;
  if (existingRecord) {
    const { data, error } = await supabase
      .from('attendance_records')
      .update(patch)
      .eq('id', existingRecord.id)
      .select('*')
      .single<AttendanceRecordRow>();

    if (error) return stampError(500, 'INTERNAL_ERROR', '勤怠記録の更新に失敗しました');
    record = data;
  } else {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        organization_id: store.organization_id,
        store_id: store.id,
        staff_id: staff.id,
        work_date: workDate,
        ...patch,
      })
      .select('*')
      .single<AttendanceRecordRow>();

    if (error) return stampError(500, 'INTERNAL_ERROR', '勤怠記録の作成に失敗しました');
    record = data;
  }

  const { data: event, error: eventError } = await supabase
    .from('attendance_events')
    .insert({
      organization_id: store.organization_id,
      attendance_record_id: record.id,
      store_id: store.id,
      staff_id: staff.id,
      event_type: payload.event_type,
      occurred_at: occurredAt,
      source: payload.source,
      auth_user_id: authUserId,
      kiosk_device_id: kioskDeviceId,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      gps_accuracy_meters: payload.gps_accuracy_meters ?? null,
      distance_from_store_meters: distanceFromStoreMeters,
      gps_verified: gpsVerified,
      pin_verified_at: pinVerifiedAt,
      note: payload.note ?? null,
    })
    .select('id, event_type, occurred_at')
    .single();

  if (eventError) return stampError(500, 'INTERNAL_ERROR', '打刻イベントの保存に失敗しました');

  return {
    ok: true,
    record: {
      id: record.id,
      status: record.status,
      work_date: record.work_date,
      clock_in_at: record.clock_in_at,
      clock_out_at: record.clock_out_at,
      break_minutes: record.break_minutes,
      total_work_minutes: record.total_work_minutes,
    },
    event,
  };
}
