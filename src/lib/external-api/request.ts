import type { ExternalApiContext, ExternalApiKeyContext } from './auth';
import { authenticateExternalApiRequest, loadExternalApiContext } from './auth';
import { externalApiError, internalError } from './responses';

const RATE_LIMIT = 60;
const ACCESS_LOG_TIMEOUT_MS = 250;

type RateLimitState = {
  limit: number;
  remaining: number;
  resetAt: string;
};

type ExternalApiHandler = (context: ExternalApiContext) => Promise<Response>;

function fallbackRateLimitState(now = new Date()): RateLimitState {
  const nextWindow = new Date(now);
  nextWindow.setUTCSeconds(0, 0);
  nextWindow.setUTCMinutes(nextWindow.getUTCMinutes() + 1);

  return {
    limit: RATE_LIMIT,
    remaining: 0,
    resetAt: nextWindow.toISOString(),
  };
}

function applyRateLimitHeaders(response: Response, state: RateLimitState) {
  response.headers.set('X-RateLimit-Limit', String(state.limit));
  response.headers.set('X-RateLimit-Remaining', String(state.remaining));
  response.headers.set(
    'X-RateLimit-Reset',
    String(Math.floor(new Date(state.resetAt).getTime() / 1000))
  );
  return response;
}

async function recordExternalApiAccess(
  context: ExternalApiKeyContext,
  endpoint: string,
  statusCode: number,
  rateLimit: RateLimitState
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const entry = {
      key_id: context.apiKey.id,
      endpoint,
      status_code: statusCode,
      rate_limit_window_started_at:
        statusCode === 429
          ? new Date(new Date(rateLimit.resetAt).getTime() - 60_000).toISOString()
          : null,
    };
    const query =
      statusCode === 429
        ? context.supabase.from('external_api_access_logs').upsert(entry, {
            onConflict: 'key_id,endpoint,status_code,rate_limit_window_started_at',
            ignoreDuplicates: true,
          })
        : context.supabase.from('external_api_access_logs').insert(entry);

    await Promise.race([
      query,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, ACCESS_LOG_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Access logging is best-effort and must not replace the API response.
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function finalizeResponse(
  context: ExternalApiKeyContext,
  endpoint: string,
  response: Response,
  rateLimit: RateLimitState
) {
  applyRateLimitHeaders(response, rateLimit);
  await recordExternalApiAccess(context, endpoint, response.status, rateLimit);
  return response;
}

export async function withExternalApiRequest(
  request: Request,
  handler: ExternalApiHandler
) {
  const fallback = fallbackRateLimitState();
  let auth: Awaited<ReturnType<typeof authenticateExternalApiRequest>>;
  try {
    auth = await authenticateExternalApiRequest(request);
  } catch {
    return applyRateLimitHeaders(internalError(), fallback);
  }

  if (!auth.ok) return applyRateLimitHeaders(auth.response, fallback);

  const keyContext = auth.context;
  const endpoint = new URL(request.url).pathname;

  try {
    const { data, error } = await keyContext.supabase.rpc(
      'consume_external_api_rate_limit',
      { p_key_id: keyContext.apiKey.id }
    );
    const rateLimitRow = data?.[0];

    if (error || !rateLimitRow) {
      return finalizeResponse(keyContext, endpoint, internalError(), fallback);
    }

    const rateLimit: RateLimitState = {
      limit: RATE_LIMIT,
      remaining: Math.max(0, rateLimitRow.remaining),
      resetAt: rateLimitRow.reset_at,
    };

    if (!rateLimitRow.allowed) {
      return finalizeResponse(
        keyContext,
        endpoint,
        externalApiError(429, 'RATE_LIMITED', 'レート制限を超過しました'),
        rateLimit
      );
    }

    const loaded = await loadExternalApiContext(keyContext);
    if (!loaded.ok) {
      return finalizeResponse(keyContext, endpoint, loaded.response, rateLimit);
    }

    let response: Response;
    try {
      response = await handler(loaded.context);
    } catch {
      response = internalError();
    }

    return finalizeResponse(keyContext, endpoint, response, rateLimit);
  } catch {
    return finalizeResponse(keyContext, endpoint, internalError(), fallback);
  }
}

export function externalApiMethodNotAllowed(request: Request) {
  return withExternalApiRequest(request, async () => {
    const response = externalApiError(
      405,
      'METHOD_NOT_ALLOWED',
      'このHTTPメソッドは利用できません'
    );
    response.headers.set('Allow', 'GET, HEAD');
    return response;
  });
}
