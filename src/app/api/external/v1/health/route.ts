import { NextResponse } from 'next/server';

import { withExternalApiRequest } from '@/lib/external-api/request';

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
