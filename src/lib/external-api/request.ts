import type { ExternalApiContext } from './auth';
import { authenticateExternalApiRequest } from './auth';
import { externalApiError, internalError } from './responses';

const RATE_LIMIT = 60;

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
  context: ExternalApiContext,
  endpoint: string,
  statusCode: number
) {
  try {
    await context.supabase.from('external_api_access_logs').insert({
      key_id: context.apiKey.id,
      endpoint,
      status_code: statusCode,
    });
  } catch {
    // Access logging is best-effort and must not replace the API response.
  }
}

async function finalizeResponse(
  context: ExternalApiContext,
  endpoint: string,
  response: Response,
  rateLimit: RateLimitState
) {
  applyRateLimitHeaders(response, rateLimit);
  await recordExternalApiAccess(context, endpoint, response.status);
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

  const { context } = auth;
  const endpoint = new URL(request.url).pathname;

  try {
    const { data, error } = await context.supabase.rpc(
      'consume_external_api_rate_limit',
      { p_key_id: context.apiKey.id }
    );
    const rateLimitRow = data?.[0];

    if (error || !rateLimitRow) {
      return finalizeResponse(context, endpoint, internalError(), fallback);
    }

    const rateLimit: RateLimitState = {
      limit: RATE_LIMIT,
      remaining: Math.max(0, rateLimitRow.remaining),
      resetAt: rateLimitRow.reset_at,
    };

    if (!rateLimitRow.allowed) {
      return finalizeResponse(
        context,
        endpoint,
        externalApiError(429, 'RATE_LIMITED', 'レート制限を超過しました'),
        rateLimit
      );
    }

    let response: Response;
    try {
      response = await handler(context);
    } catch {
      response = internalError();
    }

    return finalizeResponse(context, endpoint, response, rateLimit);
  } catch {
    return finalizeResponse(context, endpoint, internalError(), fallback);
  }
}
