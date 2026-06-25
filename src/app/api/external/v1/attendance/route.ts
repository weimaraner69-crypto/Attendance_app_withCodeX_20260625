import { NextResponse } from 'next/server';

import { authenticateExternalApiRequest } from '@/lib/external-api/auth';
import { parseDateRange, parseUuidParam } from '@/lib/external-api/params';
import { externalApiError, internalError } from '@/lib/external-api/responses';
import type { Database } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ATTENDANCE_STATUSES = new Set<Database['public']['Enums']['attendance_status']>([
  'not_started',
  'working',
  'on_break',
  'finished',
]);

const PAGE_SIZE = 500;

type AttendanceRecordRow = {
  id: string;
  work_date: string;
  status: Database['public']['Enums']['attendance_status'];
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_minutes: number;
  total_work_minutes: number;
  night_shift_minutes: number;
  is_manual: boolean;
  note: string | null;
  updated_at: string;
  staff: {
    id: string;
    employee_code: string | null;
    name: string;
  } | null;
};

export async function GET(request: Request) {
  try {
    const auth = await authenticateExternalApiRequest(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const storeId = parseUuidParam('store_id', url.searchParams.get('store_id'), true);
    if (!storeId.ok) return storeId.response;
    const requestedStoreId = storeId.value as string;

    const range = parseDateRange(url.searchParams);
    if (!range.ok) return range.response;

    const includeEvents = url.searchParams.get('include_events');
    if (includeEvents === 'true') {
      return externalApiError(400, 'INVALID_PARAMS', 'include_events は Phase 2 で対応予定です');
    }

    const statusParam = url.searchParams.get('status') ?? 'finished';
    if (!ATTENDANCE_STATUSES.has(statusParam as Database['public']['Enums']['attendance_status'])) {
      return externalApiError(400, 'INVALID_PARAMS', 'status の値が不正です', {
        status: statusParam,
      });
    }
    const status = statusParam as Database['public']['Enums']['attendance_status'];

    const cursorParam = url.searchParams.get('cursor');
    const offset = cursorParam ? Number.parseInt(cursorParam, 10) : 0;
    if (!Number.isInteger(offset) || offset < 0) {
      return externalApiError(400, 'INVALID_PARAMS', 'cursor の値が不正です', {
        cursor: cursorParam,
      });
    }

    const { supabase, organization } = auth.context;

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, code, name')
      .eq('id', requestedStoreId)
      .eq('organization_id', organization.id)
      .maybeSingle();

    if (storeError) return internalError();
    if (!store) {
      return externalApiError(404, 'NOT_FOUND', '店舗が見つかりません', {
        store_id: requestedStoreId,
      });
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .select(
        `
        id,
        work_date,
        status,
        clock_in_at,
        clock_out_at,
        break_minutes,
        total_work_minutes,
        night_shift_minutes,
        is_manual,
        note,
        updated_at,
        staff:staff_id (
          id,
          employee_code,
          name
        )
      `
      )
      .eq('organization_id', organization.id)
      .eq('store_id', store.id)
      .eq('status', status)
      .gte('work_date', range.value.from)
      .lte('work_date', range.value.to)
      .order('work_date', { ascending: true })
      .order('updated_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE);

    if (error) return internalError();

    const rows = (data ?? []) as AttendanceRecordRow[];
    const pageRows = rows.slice(0, PAGE_SIZE);
    const nextCursor = rows.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null;

    return NextResponse.json({
      store,
      range: range.value,
      records: pageRows.map((record) => ({
        id: record.id,
        staff: record.staff,
        work_date: record.work_date,
        status: record.status,
        clock_in_at: record.clock_in_at,
        clock_out_at: record.clock_out_at,
        break_minutes: record.break_minutes,
        total_work_minutes: record.total_work_minutes,
        night_shift_minutes: record.night_shift_minutes,
        is_manual: record.is_manual,
        note: record.note,
        updated_at: record.updated_at,
      })),
      count: pageRows.length,
      next_cursor: nextCursor,
    });
  } catch {
    return internalError();
  }
}
