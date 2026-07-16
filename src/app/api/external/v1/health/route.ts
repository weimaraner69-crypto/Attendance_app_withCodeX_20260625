import { NextResponse } from 'next/server';

import {
  externalApiMethodNotAllowed,
  withExternalApiRequest,
} from '@/lib/external-api/request';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withExternalApiRequest(request, async ({ organization, apiKey }) => {
    return NextResponse.json({
      ok: true,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      api_key: {
        name: apiKey.name,
        scopes: apiKey.scopes,
      },
      server_time: new Date().toISOString(),
    });
  });
}

export async function HEAD(request: Request) {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}

export {
  externalApiMethodNotAllowed as DELETE,
  externalApiMethodNotAllowed as OPTIONS,
  externalApiMethodNotAllowed as PATCH,
  externalApiMethodNotAllowed as POST,
  externalApiMethodNotAllowed as PUT,
};
