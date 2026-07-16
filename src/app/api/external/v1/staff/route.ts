import { NextResponse } from 'next/server';

import { parseBooleanParam, parseUuidParam } from '@/lib/external-api/params';
import { withExternalApiRequest } from '@/lib/external-api/request';
import { externalApiError, internalError } from '@/lib/external-api/responses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withExternalApiRequest(request, async ({ supabase, organization }) => {
    const url = new URL(request.url);
    const isActive = parseBooleanParam(url.searchParams.get('is_active'), true);
    if (!isActive.ok) return isActive.response;

    const storeId = parseUuidParam('store_id', url.searchParams.get('store_id'), false);
    if (!storeId.ok) return storeId.response;

    const updatedSince = url.searchParams.get('updated_since');
    if (updatedSince && Number.isNaN(Date.parse(updatedSince))) {
      return externalApiError(400, 'INVALID_PARAMS', 'updated_since の形式が不正です', {
        updated_since: updatedSince,
      });
    }

    let staffIds: string[] | null = null;
    if (storeId.value) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: assignments, error: assignmentsError } = await supabase
        .from('store_staff_assignments')
        .select('staff_id')
        .eq('organization_id', organization.id)
        .eq('store_id', storeId.value)
        .lte('starts_on', today)
        .or(`ends_on.is.null,ends_on.gte.${today}`);

      if (assignmentsError) return internalError();

      staffIds = (assignments ?? []).map((assignment) => assignment.staff_id);
      if (staffIds.length === 0) {
        return NextResponse.json({ staff: [], count: 0 });
      }
    }

    let query = supabase
      .from('staff')
      .select(
        'id, employee_code, name, name_kana, default_store_id, employment_type, is_active, joined_on, retired_on, updated_at'
      )
      .eq('organization_id', organization.id)
      .eq('is_active', isActive.value)
      .order('name', { ascending: true });

    if (staffIds) query = query.in('id', staffIds);
    if (updatedSince) query = query.gte('updated_at', updatedSince);

    const { data, error } = await query;
    if (error) return internalError();

    return NextResponse.json({
      staff: data ?? [],
      count: data?.length ?? 0,
    });
  });
}
