import { NextResponse } from 'next/server';

import { authenticateExternalApiRequest } from '@/lib/external-api/auth';
import { internalError } from '@/lib/external-api/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await authenticateExternalApiRequest(request);
    if (!auth.ok) return auth.response;

    const { organization, apiKey } = auth.context;

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
  } catch {
    return internalError();
  }
}
