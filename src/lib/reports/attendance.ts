import { createSupabaseAdminClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type AttendanceStatus = Database['public']['Enums']['attendance_status'];

export type ReportStore = {
  id: string;
  name: string;
};

export type ReportStaff = {
  id: string;
  name: string;
  employee_code: string | null;
};

export type AttendanceReportRow = {
  id: string;
  work_date: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number;
  total_work_minutes: number;
  night_shift_minutes: number;
  is_manual: boolean;
  note: string | null;
  staff: ReportStaff | null;
  stores: ReportStore | null;
};

export type AttendanceReportFilters = {
  from: string;
  to: string;
  storeId: string;
  staffId: string;
};

export function getTokyoDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: getTokyoDateString(start),
    to: getTokyoDateString(end),
  };
}

export function getReportFilters(searchParams: Record<string, string | string[] | undefined>): AttendanceReportFilters {
  const month = getCurrentMonthRange();
  const value = (key: string, fallback = '') => {
    const raw = searchParams[key];
    return Array.isArray(raw) ? raw[0] ?? fallback : raw ?? fallback;
  };

  return {
    from: value('from', month.from),
    to: value('to', month.to),
    storeId: value('store_id'),
    staffId: value('staff_id'),
  };
}

export function formatTokyoTime(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function formatMinutes(minutes: number) {
  if (minutes <= 0) return '0分';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

export function summarizeAttendance(rows: AttendanceReportRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.workDays += row.status === 'not_started' ? 0 : 1;
      summary.totalWorkMinutes += row.total_work_minutes;
      summary.totalBreakMinutes += row.break_minutes;
      summary.nightShiftMinutes += row.night_shift_minutes;
      summary.manualCount += row.is_manual ? 1 : 0;
      summary.missingClockOut += row.clock_in_at && !row.clock_out_at ? 1 : 0;
      return summary;
    },
    {
      workDays: 0,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
      nightShiftMinutes: 0,
      manualCount: 0,
      missingClockOut: 0,
    },
  );
}

export async function loadAttendanceReport(organizationId: string, filters: AttendanceReportFilters) {
  const supabase = createSupabaseAdminClient();

  const [{ data: stores }, { data: staff }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('staff')
      .select('id, name, employee_code')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  let query = supabase
    .from('attendance_records')
    .select('id, work_date, status, clock_in_at, clock_out_at, break_minutes, total_work_minutes, night_shift_minutes, is_manual, note, staff:staff_id (id, name, employee_code), stores:store_id (id, name)')
    .eq('organization_id', organizationId)
    .gte('work_date', filters.from)
    .lte('work_date', filters.to)
    .order('work_date', { ascending: false });

  if (filters.storeId) query = query.eq('store_id', filters.storeId);
  if (filters.staffId) query = query.eq('staff_id', filters.staffId);

  const { data: records } = await query;

  return {
    stores: (stores ?? []) as ReportStore[],
    staff: (staff ?? []) as ReportStaff[],
    rows: (records ?? []) as AttendanceReportRow[],
  };
}
