import { createHmac, timingSafeEqual } from 'crypto';

import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';

type EventCursorPayload = {
  organizationId: string;
  attendanceRecordId: string;
  occurredAt: string;
  id: string;
};

function sign(encodedPayload: string) {
  return createHmac('sha256', getSupabaseServiceRoleKey())
    .update(`attendance-external-event-cursor:${encodedPayload}`)
    .digest('base64url');
}

export function encodeEventCursor(payload: EventCursorPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function decodeEventCursor(value: string): EventCursorPayload | null {
  const [encodedPayload, providedSignature, extra] = value.split('.');
  if (!encodedPayload || !providedSignature || extra) return null;

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(providedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as EventCursorPayload;
    if (
      typeof payload.organizationId !== 'string' ||
      typeof payload.attendanceRecordId !== 'string' ||
      typeof payload.occurredAt !== 'string' ||
      typeof payload.id !== 'string' ||
      Number.isNaN(Date.parse(payload.occurredAt))
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
