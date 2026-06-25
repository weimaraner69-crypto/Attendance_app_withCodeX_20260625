import { NextResponse } from 'next/server';

export type ExternalApiErrorCode =
  | 'INVALID_PARAMS'
  | 'INVALID_DATE_RANGE'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export function externalApiError(
  status: number,
  code: ExternalApiErrorCode,
  message: string,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

export function internalError() {
  return externalApiError(500, 'INTERNAL_ERROR', 'サーバー内部エラーが発生しました');
}
