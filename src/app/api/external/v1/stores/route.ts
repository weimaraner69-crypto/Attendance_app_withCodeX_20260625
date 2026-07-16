import { NextResponse } from 'next/server';

import { parseBooleanParam } from '@/lib/external-api/params';
import {
  externalApiMethodNotAllowed,
  withExternalApiRequest,
} from '@/lib/external-api/request';
import { internalError } from '@/lib/external-api/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withExternalApiRequest(request, async ({ supabase, organization }) => {
    const url = new URL(request.url);
    const isActive = parseBooleanParam(url.searchParams.get('is_active'), true);
    if (!isActive.ok) return isActive.response;

    const { data, error } = await supabase
      .from('stores')
      .select('id, code, name, is_active')
      .eq('organization_id', organization.id)
      .eq('is_active', isActive.value)
      .order('name', { ascending: true });

    if (error) return internalError();

    return NextResponse.json({
      stores: data ?? [],
      count: data?.length ?? 0,
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
