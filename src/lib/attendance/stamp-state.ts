import type { Database } from '@/lib/supabase';

type AttendanceEventType = Database['public']['Enums']['attendance_event_type'];
type AttendanceStatus = Database['public']['Enums']['attendance_status'];

export type AttendanceRecordState = {
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number;
};

type StampTransitionError = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

function transitionError(code: string, message: string): StampTransitionError {
  return { ok: false, status: 409, code, message };
}

export function minutesBetween(startIso: string, endIso: string) {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
}

export function calculateRecordPatch(
  record: AttendanceRecordState | null,
  eventType: AttendanceEventType,
  occurredAt: string,
  additionalBreakMinutes: number
) {
  if (eventType === 'clock_in') {
    if (record?.clock_in_at) {
      return transitionError('DUPLICATE_CLOCK_IN', 'すでに出勤打刻済みです');
    }

    return {
      status: 'working' as AttendanceStatus,
      clock_in_at: occurredAt,
      clock_out_at: null,
      break_minutes: record?.break_minutes ?? 0,
      total_work_minutes: 0,
    };
  }

  if (!record?.clock_in_at) {
    return transitionError('CLOCK_IN_REQUIRED', '先に出勤打刻が必要です');
  }

  if (eventType === 'break_start') {
    if (record.status === 'on_break') {
      return transitionError('DUPLICATE_BREAK_START', 'すでに休憩中です');
    }
    if (record.status === 'finished') {
      return transitionError('ALREADY_FINISHED', '退勤済みです');
    }

    return {
      status: 'on_break' as AttendanceStatus,
      break_minutes: record.break_minutes,
    };
  }

  if (eventType === 'break_end') {
    if (record.status !== 'on_break') {
      return transitionError('BREAK_START_REQUIRED', '先に休憩開始打刻が必要です');
    }

    return {
      status: 'working' as AttendanceStatus,
      break_minutes: record.break_minutes + additionalBreakMinutes,
    };
  }

  if (record.status === 'finished' || record.clock_out_at) {
    return transitionError('DUPLICATE_CLOCK_OUT', 'すでに退勤打刻済みです');
  }
  if (record.status === 'on_break') {
    return transitionError('BREAK_END_REQUIRED', '休憩終了後に退勤してください');
  }

  const breakMinutes = record.break_minutes;
  const totalWorkMinutes = Math.max(0, minutesBetween(record.clock_in_at, occurredAt) - breakMinutes);

  return {
    status: 'finished' as AttendanceStatus,
    clock_out_at: occurredAt,
    break_minutes: breakMinutes,
    total_work_minutes: totalWorkMinutes,
  };
}
