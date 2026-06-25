import { NextResponse } from 'next/server';

import { stampAttendance } from '@/lib/attendance/stamp';
import type { Database } from '@/lib/supabase';

type AttendanceEventType = Database['public']['Enums']['attendance_event_type'];

const EVENT_TYPES = new Set<AttendanceEventType>([
  'clock_in',
  'break_start',
  'break_end',
  'clock_out',
]);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'JSON body が不正です' } },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'body が不正です' } },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;
  const eventType = payload.event_type;
  const source = payload.source;

  if (typeof payload.store_id !== 'string' || typeof payload.staff_id !== 'string') {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAMS', message: 'store_id と staff_id は必須です' } },
      { status: 400 }
    );
  }

  if (typeof eventType !== 'string' || !EVENT_TYPES.has(eventType as AttendanceEventType)) {
    return NextResponse.json(
      { error: { code: 'INVALID_EVENT_TYPE', message: 'event_type が不正です' } },
      { status: 400 }
    );
  }

  if (source !== 'kiosk' && source !== 'mobile_web') {
    return NextResponse.json(
      { error: { code: 'INVALID_SOURCE', message: 'source は kiosk または mobile_web を指定してください' } },
      { status: 400 }
    );
  }

  const result = await stampAttendance({
    store_id: payload.store_id,
    staff_id: payload.staff_id,
    event_type: eventType as AttendanceEventType,
    source,
    occurred_at: typeof payload.occurred_at === 'string' ? payload.occurred_at : undefined,
    pin: typeof payload.pin === 'string' ? payload.pin : undefined,
    kiosk_device_id: typeof payload.kiosk_device_id === 'string' ? payload.kiosk_device_id : undefined,
    latitude: typeof payload.latitude === 'number' ? payload.latitude : undefined,
    longitude: typeof payload.longitude === 'number' ? payload.longitude : undefined,
    gps_accuracy_meters:
      typeof payload.gps_accuracy_meters === 'number' ? payload.gps_accuracy_meters : undefined,
    note: typeof payload.note === 'string' ? payload.note : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: result.code,
          message: result.message,
          ...(result.details ? { details: result.details } : {}),
        },
      },
      { status: result.status }
    );
  }

  return NextResponse.json(result);
}
