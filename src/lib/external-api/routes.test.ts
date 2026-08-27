import { beforeEach, describe, expect, it, vi } from 'vitest';

const { externalApiMethodNotAllowedMock, withExternalApiRequestMock } = vi.hoisted(() => ({
  externalApiMethodNotAllowedMock: vi.fn(),
  withExternalApiRequestMock: vi.fn(),
}));

vi.mock('@/lib/external-api/request', () => ({
  externalApiMethodNotAllowed: externalApiMethodNotAllowedMock,
  withExternalApiRequest: withExternalApiRequestMock,
}));

import { GET as getAttendance } from '@/app/api/external/v1/attendance/route';
import { GET as getAttendanceDetail } from '@/app/api/external/v1/attendance/[record_id]/route';
import {
  GET as getHealth,
  HEAD as headHealth,
  OPTIONS as optionsHealth,
  POST as postHealth,
} from '@/app/api/external/v1/health/route';

const organization = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Contract Test Organization',
  timezone: 'Asia/Tokyo',
};

const apiKey = {
  id: 'key-id',
  name: 'Daily report production',
  scopes: ['attendance:read'],
};

const apiOrigin = ['https:', '', 'attendance.example'].join('/');

function authenticatedContext(supabase: unknown) {
  withExternalApiRequestMock.mockImplementation(
    async (_request: Request, handler: (context: unknown) => Promise<Response>) =>
      handler({ supabase, organization, apiKey })
  );
}

function chainWithResult(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'or']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.range = vi.fn().mockResolvedValue(result);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

describe('Phase 1 external API contracts', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    externalApiMethodNotAllowedMock.mockReset();
    externalApiMethodNotAllowedMock.mockImplementation(async () => {
      const response = new Response('method not allowed', { status: 405 });
      response.headers.set('Allow', 'GET, HEAD');
      return response;
    });
    withExternalApiRequestMock.mockReset();
  });

  it('keeps the health response shape stable', async () => {
    authenticatedContext({});

    const response = await getHealth(
      new Request(`${apiOrigin}/api/external/v1/health`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      organization: { id: organization.id, name: organization.name },
      api_key: { name: apiKey.name, scopes: apiKey.scopes },
    });
    expect(Object.keys(body).sort()).toEqual(['api_key', 'ok', 'organization', 'server_time']);
    expect(new Date(body.server_time).toISOString()).toBe(body.server_time);
  });

  it('routes HEAD through the guarded GET handler without a body', async () => {
    authenticatedContext({});

    const response = await headHealth(
      new Request(`${apiOrigin}/api/external/v1/health`, { method: 'HEAD' })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(withExternalApiRequestMock).toHaveBeenCalledOnce();
  });

  it('routes POST and OPTIONS through the guarded method rejection', async () => {
    const postResponse = await postHealth(
      new Request(`${apiOrigin}/api/external/v1/health`, { method: 'POST' })
    );
    const optionsResponse = await optionsHealth(
      new Request(`${apiOrigin}/api/external/v1/health`, { method: 'OPTIONS' })
    );

    expect(postResponse.status).toBe(405);
    expect(optionsResponse.status).toBe(405);
    expect(postResponse.headers.get('Allow')).toBe('GET, HEAD');
    expect(externalApiMethodNotAllowedMock).toHaveBeenCalledTimes(2);
  });

  it('returns the canonical error envelope for invalid attendance parameters', async () => {
    authenticatedContext({});

    const response = await getAttendance(
      new Request(`${apiOrigin}/api/external/v1/attendance`)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'INVALID_PARAMS',
        message: 'store_id は必須です',
      },
    });
  });

  it('keeps include_events disabled during Phase 1', async () => {
    authenticatedContext({});
    const request = new Request(
      `${apiOrigin}/api/external/v1/attendance?store_id=${organization.id}&from=2026-07-01&to=2026-07-01&include_events=true`
    );

    const response = await getAttendance(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_PARAMS' },
    });
  });

  it('enforces the authenticated organization when resolving a store', async () => {
    const storeQuery = chainWithResult({ data: null, error: null });
    const supabase = { from: vi.fn(() => storeQuery) };
    authenticatedContext(supabase);

    const request = new Request(
      `${apiOrigin}/api/external/v1/attendance?store_id=${organization.id}&from=2026-07-01&to=2026-07-01`
    );
    const response = await getAttendance(request);

    expect(response.status).toBe(404);
    expect(storeQuery.eq).toHaveBeenCalledWith('organization_id', organization.id);
    expect(await response.json()).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });

  it('keeps the attendance list response compatible with the Phase 1 contract', async () => {
    const store = {
      id: organization.id,
      code: 'STORE-01',
      name: 'Contract Store',
    };
    const record = {
      id: '22222222-2222-4222-8222-222222222222',
      work_date: '2026-07-01',
      status: 'finished',
      clock_in_at: '2026-07-01T00:00:00.000Z',
      clock_out_at: '2026-07-01T09:00:00.000Z',
      break_minutes: 60,
      total_work_minutes: 480,
      night_shift_minutes: 0,
      is_manual: false,
      note: null,
      updated_at: '2026-07-01T09:00:01.000Z',
      staff: {
        id: '33333333-3333-4333-8333-333333333333',
        employee_code: 'E-001',
        name: 'Contract Staff',
      },
    };
    const storeQuery = chainWithResult({ data: store, error: null });
    const attendanceQuery = chainWithResult({ data: [record], error: null });
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'stores' ? storeQuery : attendanceQuery
      ),
    };
    authenticatedContext(supabase);

    const request = new Request(
      `${apiOrigin}/api/external/v1/attendance?store_id=${organization.id}&from=2026-07-01&to=2026-07-01`
    );
    const response = await getAttendance(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      store,
      range: { from: '2026-07-01', to: '2026-07-01' },
      records: [record],
      count: 1,
      next_cursor: null,
    });
    expect(attendanceQuery.eq).toHaveBeenCalledWith('organization_id', organization.id);
    expect(attendanceQuery.range).toHaveBeenCalledWith(0, 500);
  });

  it('returns a fixed attendance detail without note or events by default', async () => {
    const record = {
      id: '22222222-2222-4222-8222-222222222222',
      work_date: '2026-07-01', status: 'finished', clock_in_at: '2026-07-01T00:00:00.000Z',
      clock_out_at: '2026-07-01T09:00:00.000Z', break_minutes: 60,
      total_work_minutes: 480, night_shift_minutes: 0, is_manual: true,
      updated_at: '2026-07-01T09:00:01.000Z',
      store: { id: organization.id, code: 'STORE-01', name: 'Contract Store' },
      staff: { id: '33333333-3333-4333-8333-333333333333', employee_code: 'E-001', name: 'Contract Staff' },
    };
    const recordQuery = chainWithResult({ data: record, error: null });
    authenticatedContext({ from: vi.fn(() => recordQuery) });

    const response = await getAttendanceDetail(
      new Request(`${apiOrigin}/api/external/v1/attendance/${record.id}`),
      { params: { record_id: record.id } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      store: record.store,
      record: {
        id: record.id, staff: record.staff, work_date: record.work_date, status: record.status,
        clock_in_at: record.clock_in_at, clock_out_at: record.clock_out_at,
        break_minutes: 60, total_work_minutes: 480, night_shift_minutes: 0,
        is_manual: true, updated_at: record.updated_at,
      },
    });
    expect(recordQuery.eq).toHaveBeenCalledWith('organization_id', organization.id);
  });

  it('rejects invalid detail parameters before querying attendance data', async () => {
    authenticatedContext({ from: vi.fn() });

    const invalidBoolean = await getAttendanceDetail(
      new Request(`${apiOrigin}/api/external/v1/attendance/${organization.id}?include_events=yes`),
      { params: { record_id: organization.id } }
    );
    const invalidCursorUse = await getAttendanceDetail(
      new Request(`${apiOrigin}/api/external/v1/attendance/${organization.id}?event_cursor=cursor`),
      { params: { record_id: organization.id } }
    );

    expect(invalidBoolean.status).toBe(400);
    expect(invalidCursorUse.status).toBe(400);
  });

  it('returns stable, minimal event pages and rejects a tampered cursor', async () => {
    const record = {
      id: '22222222-2222-4222-8222-222222222222', work_date: '2026-07-01', status: 'finished',
      clock_in_at: null, clock_out_at: null, break_minutes: 0, total_work_minutes: 0,
      night_shift_minutes: 0, is_manual: false, updated_at: '2026-07-01T09:00:01.000Z',
      store: { id: organization.id, code: 'STORE-01', name: 'Contract Store' },
      staff: { id: '33333333-3333-4333-8333-333333333333', employee_code: null, name: 'Contract Staff' },
    };
    const events = Array.from({ length: 101 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      event_type: 'clock_in', occurred_at: `2026-07-01T00:${String(index % 60).padStart(2, '0')}:00.000Z`, source: 'mobile_web',
    }));
    const recordQuery = chainWithResult({ data: record, error: null });
    const eventQuery = chainWithResult({ data: events, error: null });
    authenticatedContext({ from: vi.fn((table: string) => table === 'attendance_records' ? recordQuery : eventQuery) });

    const response = await getAttendanceDetail(
      new Request(`${apiOrigin}/api/external/v1/attendance/${record.id}?include_events=true`),
      { params: { record_id: record.id } }
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.events.items).toHaveLength(100);
    expect(Object.keys(body.events.items[0]).sort()).toEqual(['event_type', 'id', 'occurred_at', 'source']);
    expect(body.events.next_cursor).toEqual(expect.any(String));
    expect(eventQuery.order).toHaveBeenNthCalledWith(1, 'occurred_at', { ascending: true });
    expect(eventQuery.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(eventQuery.limit).toHaveBeenCalledWith(101);

    const continuation = await getAttendanceDetail(
      new Request(`${apiOrigin}/api/external/v1/attendance/${record.id}?include_events=true&event_cursor=${body.events.next_cursor}`),
      { params: { record_id: record.id } }
    );
    expect(continuation.status).toBe(200);
    expect(eventQuery.or).toHaveBeenCalledOnce();

    const invalid = await getAttendanceDetail(
      new Request(`${apiOrigin}/api/external/v1/attendance/${record.id}?include_events=true&event_cursor=${body.events.next_cursor}x`),
      { params: { record_id: record.id } }
    );
    expect(invalid.status).toBe(400);
  });
});
