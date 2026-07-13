import { describe, expect, it } from 'vitest';

import { calculateRecordPatch, type AttendanceRecordState } from './stamp-state';

const clockInAt = '2026-07-01T00:00:00.000Z';

function record(overrides: Partial<AttendanceRecordState> = {}): AttendanceRecordState {
  return {
    status: 'working',
    clock_in_at: clockInAt,
    clock_out_at: null,
    break_minutes: 0,
    ...overrides,
  };
}

describe('attendance stamp state transitions', () => {
  it('starts a new work record on clock in', () => {
    expect(calculateRecordPatch(null, 'clock_in', clockInAt, 0)).toEqual({
      status: 'working',
      clock_in_at: clockInAt,
      clock_out_at: null,
      break_minutes: 0,
      total_work_minutes: 0,
    });
  });

  it('rejects duplicate clock in and events before clock in', () => {
    expect(calculateRecordPatch(record(), 'clock_in', clockInAt, 0)).toMatchObject({
      ok: false,
      status: 409,
      code: 'DUPLICATE_CLOCK_IN',
    });
    expect(calculateRecordPatch(null, 'break_start', clockInAt, 0)).toMatchObject({
      code: 'CLOCK_IN_REQUIRED',
    });
  });

  it('requires break start before break end and break end before clock out', () => {
    expect(calculateRecordPatch(record(), 'break_end', clockInAt, 10)).toMatchObject({
      code: 'BREAK_START_REQUIRED',
    });
    expect(
      calculateRecordPatch(record({ status: 'on_break' }), 'clock_out', clockInAt, 0)
    ).toMatchObject({ code: 'BREAK_END_REQUIRED' });
  });

  it('adds the measured break and subtracts it from worked minutes', () => {
    const afterBreak = calculateRecordPatch(
      record({ status: 'on_break', break_minutes: 15 }),
      'break_end',
      '2026-07-01T02:00:00.000Z',
      30
    );
    expect(afterBreak).toEqual({ status: 'working', break_minutes: 45 });

    const finished = calculateRecordPatch(
      record({ break_minutes: 45 }),
      'clock_out',
      '2026-07-01T09:00:00.000Z',
      0
    );
    expect(finished).toMatchObject({
      status: 'finished',
      break_minutes: 45,
      total_work_minutes: 495,
    });
  });

  it('never creates negative worked minutes', () => {
    const finished = calculateRecordPatch(
      record({ break_minutes: 120 }),
      'clock_out',
      '2026-07-01T01:00:00.000Z',
      0
    );
    expect(finished).toMatchObject({ total_work_minutes: 0 });
  });
});
