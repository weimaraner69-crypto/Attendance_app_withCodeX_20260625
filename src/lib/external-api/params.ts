import { externalApiError } from './responses';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidIsoDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseBooleanParam(value: string | null, defaultValue: boolean) {
  if (value === null || value === '') return { ok: true as const, value: defaultValue };
  if (value === 'true') return { ok: true as const, value: true };
  if (value === 'false') return { ok: true as const, value: false };
  return {
    ok: false as const,
    response: externalApiError(400, 'INVALID_PARAMS', 'boolean パラメータが不正です', {
      value,
    }),
  };
}

export function parseUuidParam(name: string, value: string | null, required: boolean) {
  if (!value) {
    if (!required) return { ok: true as const, value: null };
    return {
      ok: false as const,
      response: externalApiError(400, 'INVALID_PARAMS', `${name} は必須です`),
    };
  }

  if (!UUID_PATTERN.test(value)) {
    return {
      ok: false as const,
      response: externalApiError(400, 'INVALID_PARAMS', `${name} の形式が不正です`, {
        [name]: value,
      }),
    };
  }

  return { ok: true as const, value };
}

export function parseDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return {
      ok: false as const,
      response: externalApiError(400, 'INVALID_PARAMS', 'from と to は必須です'),
    };
  }

  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return {
      ok: false as const,
      response: externalApiError(400, 'INVALID_PARAMS', '日付は YYYY-MM-DD 形式で指定してください', {
        from,
        to,
      }),
    };
  }

  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);

  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return {
      ok: false as const,
      response: externalApiError(400, 'INVALID_PARAMS', '日付が不正です', { from, to }),
    };
  }

  if (toTime < fromTime) {
    return {
      ok: false as const,
      response: externalApiError(400, 'INVALID_DATE_RANGE', 'to は from 以降の日付を指定してください', {
        from,
        to,
      }),
    };
  }

  const days = Math.floor((toTime - fromTime) / 86_400_000) + 1;
  if (days > 31) {
    return {
      ok: false as const,
      response: externalApiError(400, 'INVALID_DATE_RANGE', 'from と to の差が31日を超えています', {
        from,
        to,
      }),
    };
  }

  return { ok: true as const, value: { from, to } };
}
