import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          supabase_configured: true,
          organizations_accessible: false,
          error: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      supabase_configured: true,
      organizations_accessible: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        supabase_configured: false,
        organizations_accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
