import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MobileStampPanel } from '@/components/stamp/MobileStampPanel';
import { Button } from '@/components/ui/button';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

type StoreRow = {
  id: string;
  name: string;
};

export default async function MobileStampPage() {
  const context = await requireAuthenticatedRole(['staff']);
  if (!context.staff) redirect('/login');

  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: assignments } = await supabase
    .from('store_staff_assignments')
    .select('store_id')
    .eq('staff_id', context.staff.id)
    .lte('starts_on', today)
    .or(`ends_on.is.null,ends_on.gte.${today}`);

  const storeIds = Array.from(new Set([
    ...(assignments ?? []).map((assignment) => assignment.store_id),
    ...(context.staff.default_store_id ? [context.staff.default_store_id] : []),
  ]));

  const { data: stores } = storeIds.length > 0
    ? await supabase
        .from('stores')
        .select('id, name')
        .in('id', storeIds)
        .eq('is_active', true)
        .order('name', { ascending: true })
    : { data: [] };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">個人スマホ打刻</h1>
            <p className="mt-1 text-sm text-gray-600">GPSを取得して、出勤・退勤・休憩を記録します。</p>
          </div>
          <Link href="/stamp">
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <MobileStampPanel
          staffId={context.staff.id}
          staffName={context.profile.display_name}
          stores={(stores ?? []) as StoreRow[]}
          defaultStoreId={context.staff.default_store_id}
        />
      </div>
    </main>
  );
}
