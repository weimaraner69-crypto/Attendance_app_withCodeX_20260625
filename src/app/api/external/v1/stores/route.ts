import { NextResponse } from 'next/server';

import { authenticateExternalApiRequest } from '@/lib/external-api/auth';
import { parseBooleanParam } from '@/lib/external-api/params';
import { internalError } from '@/lib/external-api/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await authenticateExternalApiRequest(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const isActive = parseBooleanParam(url.searchParams.get('is_active'), true);
    if (!isActive.ok) return isActive.response;

    const { supabase, organization } = auth.context;
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
  } catch {
    return internalError();
  }
}
