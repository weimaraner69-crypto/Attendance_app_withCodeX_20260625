import { describe, expect, it } from 'vitest';

import { parseBooleanParam, parseDateRange, parseUuidParam } from './params';

async function errorBody(result: ReturnType<typeof parseDateRange>) {
  if (result.ok) throw new Error('Expected an error response');
  return result.response.json();
}

describe('external API parameters', () => {
  it('parses booleans strictly and applies the default only when omitted', async () => {
    expect(parseBooleanParam(null, true)).toEqual({ ok: true, value: true });
    expect(parseBooleanParam('', false)).toEqual({ ok: true, value: false });
    expect(parseBooleanParam('true', false)).toEqual({ ok: true, value: true });
    expect(parseBooleanParam('false', true)).toEqual({ ok: true, value: false });

    const invalid = parseBooleanParam('TRUE', false);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.response.status).toBe(400);
      expect(await invalid.response.json()).toEqual({
        error: {
          code: 'INVALID_PARAMS',
          message: 'boolean パラメータが不正です',
          details: { value: 'TRUE' },
        },
      });
    }
  });

  it('rejects missing and malformed UUID parameters', async () => {
    expect(parseUuidParam('store_id', null, false)).toEqual({ ok: true, value: null });

    const missing = parseUuidParam('store_id', null, true);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(await missing.response.json()).toMatchObject({
        error: { code: 'INVALID_PARAMS' },
      });
    }

    const malformed = parseUuidParam('store_id', 'not-a-uuid', true);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(await malformed.response.json()).toMatchObject({
        error: {
          code: 'INVALID_PARAMS',
          details: { store_id: 'not-a-uuid' },
        },
      });
    }
  });

  it('accepts a 31-day inclusive range and rejects a 32-day range', async () => {
    const accepted = parseDateRange(new URLSearchParams('from=2026-01-01&to=2026-01-31'));
    expect(accepted).toEqual({
      ok: true,
      value: { from: '2026-01-01', to: '2026-01-31' },
    });

    const rejected = parseDateRange(new URLSearchParams('from=2026-01-01&to=2026-02-01'));
    expect(rejected.ok).toBe(false);
    expect(await errorBody(rejected)).toMatchObject({
      error: { code: 'INVALID_DATE_RANGE' },
    });
  });

  it('rejects reversed ranges and calendar dates that do not exist', async () => {
    const reversed = parseDateRange(new URLSearchParams('from=2026-07-02&to=2026-07-01'));
    expect(await errorBody(reversed)).toMatchObject({
      error: { code: 'INVALID_DATE_RANGE' },
    });

    const invalidDate = parseDateRange(
      new URLSearchParams('from=2026-02-30&to=2026-03-01')
    );
    expect(await errorBody(invalidDate)).toEqual({
      error: {
        code: 'INVALID_PARAMS',
        message: '日付が不正です',
        details: { from: '2026-02-30', to: '2026-03-01' },
      },
    });
  });
});
