import { randomBytes } from 'crypto';

import { hashExternalApiKey } from './auth';

export const externalApiKeyScopes = ['attendance:read'] as const;

export type ExternalApiKeyScope = (typeof externalApiKeyScopes)[number];

export type ExternalApiKeyIssueInput = {
  name: string;
  scopes: string[];
  expiresOnJst: string;
};

export type ValidExternalApiKeyIssueInput = {
  name: string;
  scopes: ExternalApiKeyScope[];
  expiresAt: string | null;
};

export type ExternalApiKeyIssueValidation =
  | { ok: true; value: ValidExternalApiKeyIssueInput }
  | { ok: false; message: string };

export type PreparedExternalApiKey = {
  rawApiKey: string;
  record: {
    name: string;
    key_hash: string;
    scopes: ExternalApiKeyScope[];
    expires_at: string | null;
  };
};

export type ExternalApiKeyIssueActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; apiKey: string; warning?: string };

export type ExternalApiKeyDeactivationActionState =
  | { status: 'error'; message: string }
  | { status: 'success'; warning?: string };

const jstOffsetMinutes = 9 * 60;

function parseJstDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function expiresAtFromJstDate(value: string) {
  const parsed = parseJstDate(value);
  if (!parsed) return null;

  const endOfJstDay = Date.UTC(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999);
  return new Date(endOfJstDay - jstOffsetMinutes * 60 * 1000).toISOString();
}

export function validateExternalApiKeyIssueInput(
  input: ExternalApiKeyIssueInput,
  now = Date.now()
): ExternalApiKeyIssueValidation {
  const name = input.name.trim();
  if (!name || name.length > 100 || /[\r\n\t]/.test(name)) {
    return { ok: false, message: 'キー名は1文字以上100文字以内で入力してください。' };
  }

  const uniqueScopes = input.scopes.filter((scope, index) => input.scopes.indexOf(scope) === index);
  if (
    uniqueScopes.length !== 1 ||
    uniqueScopes.some((scope) => !externalApiKeyScopes.includes(scope as ExternalApiKeyScope))
  ) {
    return { ok: false, message: '許可されていないスコープです。' };
  }

  const expiresOnJst = input.expiresOnJst.trim();
  if (!expiresOnJst) {
    return {
      ok: true,
      value: { name, scopes: uniqueScopes as ExternalApiKeyScope[], expiresAt: null },
    };
  }

  const expiresAt = expiresAtFromJstDate(expiresOnJst);
  if (!expiresAt || Date.parse(expiresAt) <= now) {
    return { ok: false, message: '有効期限は今日以降の日付で指定してください。' };
  }

  return {
    ok: true,
    value: { name, scopes: uniqueScopes as ExternalApiKeyScope[], expiresAt },
  };
}

export function prepareExternalApiKey(
  input: ValidExternalApiKeyIssueInput,
  generateRandomBytes: (size: number) => Buffer = randomBytes
): PreparedExternalApiKey {
  const rawApiKey = `eak_${generateRandomBytes(32).toString('base64url')}`;

  return {
    rawApiKey,
    record: {
      name: input.name,
      key_hash: hashExternalApiKey(rawApiKey),
      scopes: input.scopes,
      expires_at: input.expiresAt,
    },
  };
}

export function externalApiKeyIssueSuccess(
  rawApiKey: string,
  warning?: string
): ExternalApiKeyIssueActionState {
  return warning
    ? { status: 'success', apiKey: rawApiKey, warning }
    : { status: 'success', apiKey: rawApiKey };
}

export function externalApiKeyDeactivationSuccess(
  warning?: string
): ExternalApiKeyDeactivationActionState {
  return warning ? { status: 'success', warning } : { status: 'success' };
}
