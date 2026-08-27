import { NextResponse } from 'next/server';

import { decodeEventCursor, encodeEventCursor } from '@/lib/external-api/event-cursor';
import { parseBooleanParam, parseUuidParam } from '@/lib/external-api/params';
import {
  externalApiMethodNotAllowed,
  withExternalApiRequest,
} from '@/lib/external-api/request';
import { externalApiError, internalError } from '@/lib/external-api/responses';
import type { Database } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const EVENT_PAGE_SIZE = 100;

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
  updated_at: string;
  store: { id: string; code: string; name: string } | null;
  staff: { id: string; employee_code: string | null; name: string } | null;
};

type AttendanceEventRow = {
  id: string;
  event_type: Database['public']['Enums']['attendance_event_type'];
  occurred_at: string;
  source: Database['public']['Enums']['attendance_source'];
};

export async function GET(
  request: Request,
  { params }: { params: { record_id: string } }
) {
  return withExternalApiRequest(request, async ({ supabase, organization }) => {
    const recordId = parseUuidParam('record_id', params.record_id, true);
    if (!recordId.ok) return recordId.response;
    const requestedRecordId = recordId.value;
    if (!requestedRecordId) return externalApiError(400, 'INVALID_PARAMS', 'record_id は必須です');

    const url = new URL(request.url);
    const includeEvents = parseBooleanParam(url.searchParams.get('include_events'), false);
    if (!includeEvents.ok) return includeEvents.response;

    const eventCursorParam = url.searchParams.get('event_cursor');
    if (!includeEvents.value && eventCursorParam !== null) {
      return externalApiError(400, 'INVALID_PARAMS', 'event_cursor は include_events=true の場合だけ指定できます');
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
        updated_at,
        store:store_id ( id, code, name ),
        staff:staff_id ( id, employee_code, name )
      `
      )
      .eq('id', requestedRecordId)
      .eq('organization_id', organization.id)
      .maybeSingle();

    if (error) return internalError();
    if (!data) return externalApiError(404, 'NOT_FOUND', '勤怠記録が見つかりません');

    const record = data as AttendanceRecordRow;
    if (!record.store || !record.staff) return internalError();

    const response: Record<string, unknown> = {
      store: record.store,
      record: {
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
        updated_at: record.updated_at,
      },
    };

    if (!includeEvents.value) return NextResponse.json(response);

    let cursor: ReturnType<typeof decodeEventCursor> = null;
    if (eventCursorParam) {
      cursor = decodeEventCursor(eventCursorParam);
      if (
        !cursor ||
        cursor.organizationId !== organization.id ||
        cursor.attendanceRecordId !== record.id
      ) {
        return externalApiError(400, 'INVALID_PARAMS', 'event_cursor の値が不正です');
      }
    }

    let eventQuery = supabase
      .from('attendance_events')
      .select('id, event_type, occurred_at, source')
      .eq('organization_id', organization.id)
      .eq('attendance_record_id', record.id);

    if (cursor) {
      eventQuery = eventQuery.or(
        `occurred_at.gt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.gt.${cursor.id})`
      );
    }

    const { data: eventData, error: eventError } = await eventQuery
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(EVENT_PAGE_SIZE + 1);
    if (eventError) return internalError();

    const eventRows = (eventData ?? []) as AttendanceEventRow[];
    const items = eventRows.slice(0, EVENT_PAGE_SIZE);
    const boundary = items.at(-1);
    response.events = {
      items,
      next_cursor:
        eventRows.length > EVENT_PAGE_SIZE && boundary
          ? encodeEventCursor({
              organizationId: organization.id,
              attendanceRecordId: record.id,
              occurredAt: boundary.occurred_at,
              id: boundary.id,
            })
          : null,
    };

    return NextResponse.json(response);
  });
}

export async function HEAD(
  request: Request,
  context: { params: { record_id: string } }
) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}

export {
  externalApiMethodNotAllowed as DELETE,
  externalApiMethodNotAllowed as OPTIONS,
  externalApiMethodNotAllowed as PATCH,
  externalApiMethodNotAllowed as POST,
  externalApiMethodNotAllowed as PUT,
};
