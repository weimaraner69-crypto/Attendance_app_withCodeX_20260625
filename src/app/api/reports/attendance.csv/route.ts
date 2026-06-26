import { NextResponse } from 'next/server';

import { requireAuthenticatedRole } from '@/lib/auth/session';
import {
  type AttendanceReportRow,
  formatTokyoTime,
  getReportFilters,
  loadAttendanceReport,
} from '@/lib/reports/attendance';

const headers = [
  'work_date',
  'store_name',
  'staff_name',
  'employee_code',
  'status',
  'clock_in',
  'clock_out',
  'break_minutes',
  'total_work_minutes',
  'night_shift_minutes',
  'is_manual',
  'note',
];

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function rowToCsv(row: AttendanceReportRow) {
  return [
    row.work_date,
    row.stores?.name ?? '',
    row.staff?.name ?? '',
    row.staff?.employee_code ?? '',
    row.status,
    formatTokyoTime(row.clock_in_at),
    formatTokyoTime(row.clock_out_at),
    row.break_minutes,
    row.total_work_minutes,
    row.night_shift_minutes,
    row.is_manual ? '1' : '0',
    row.note ?? '',
  ].map(csvCell).join(',');
}

export async function GET(request: Request) {
  const context = await requireAuthenticatedRole(['owner', 'sr']);
  const url = new URL(request.url);
  const filters = getReportFilters(Object.fromEntries(url.searchParams.entries()));
  const report = await loadAttendanceReport(context.profile.organization_id, filters);
  const csv = [
    headers.map(csvCell).join(','),
    ...report.rows.map(rowToCsv),
  ].join('\n');

  return new NextResponse(`\uFEFF${csv}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${filters.from}-${filters.to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
