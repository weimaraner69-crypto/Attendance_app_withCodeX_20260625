import { createHmac } from 'crypto';

import { isValidOwnerEmail, normalizeOwnerEmail } from './owner-auth-identity';

export const OWNER_RECOVERY_BODY_LIMIT_BYTES = 2 * 1024;
export const OWNER_RECOVERY_RESPONSE_FLOOR_MS = 1_200;
export const OWNER_RECOVERY_RESPONSE_JITTER_MS = 300;

export type OwnerPasswordRecoveryRateLimitOperations = {
  consumeRateLimit: (ipHash: string, emailHash: string) => Promise<boolean>;
};

function hmacRateLimitKey(secret: string, scope: 'ip' | 'email', value: string) {
  return createHmac('sha256', secret)
    .update(`attendance-owner-recovery-rate-limit:${scope}:${value}`)
    .digest('hex');
}

export function buildOwnerPasswordRecoveryRateLimitKeys(input: {
  email: string | null;
  headers: Headers;
  secret: string;
}) {
  const forwardedFor = (
    input.headers.get('x-vercel-forwarded-for')
    ?? input.headers.get('x-forwarded-for')
  )?.split(',')[0]?.trim();
  const clientAddress = (forwardedFor || input.headers.get('x-real-ip')?.trim() || 'unknown')
    .slice(0, 256);
  const normalizedEmail = normalizeOwnerEmail(input.email);
  const emailSubject = isValidOwnerEmail(normalizedEmail) ? normalizedEmail : 'invalid';

  return {
    ipHash: hmacRateLimitKey(input.secret, 'ip', clientAddress),
    emailHash: hmacRateLimitKey(input.secret, 'email', emailSubject),
  };
}

export async function consumeOwnerPasswordRecoveryRateLimit(input: {
  email: string | null;
  headers: Headers;
  secret: string;
  operations: OwnerPasswordRecoveryRateLimitOperations;
}) {
  try {
    const { ipHash, emailHash } = buildOwnerPasswordRecoveryRateLimitKeys(input);
    return await input.operations.consumeRateLimit(ipHash, emailHash);
  } catch {
    return false;
  }
}

export async function readOwnerPasswordRecoveryEmail(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > OWNER_RECOVERY_BODY_LIMIT_BYTES) {
    return null;
  }

  const reader = request.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let body = '';
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > OWNER_RECOVERY_BODY_LIMIT_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();

  try {
    const parsed = JSON.parse(body) as { email?: unknown } | null;
    return typeof parsed?.email === 'string' ? parsed.email : null;
  } catch {
    return null;
  }
}

export async function enforceOwnerPasswordRecoveryResponseFloor(
  startedAtMs: number,
  dependencies: {
    now?: () => number;
    random?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {}
) {
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const sleep = dependencies.sleep ?? (
    (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  );
  const jitter = Math.floor(random() * OWNER_RECOVERY_RESPONSE_JITTER_MS);
  const remaining = OWNER_RECOVERY_RESPONSE_FLOOR_MS + jitter - (now() - startedAtMs);
  if (remaining > 0) await sleep(remaining);
}
