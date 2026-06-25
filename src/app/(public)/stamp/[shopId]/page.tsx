import Link from 'next/link';
import { notFound } from 'next/navigation';

import { KioskStampPanel } from '@/components/stamp/KioskStampPanel';
import { Button } from '@/components/ui/button';
import { createSupabaseAdminClient } from '@/lib/supabase';

type StoreRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type StaffRow = {
  id: string;
  name: string;
  employee_code: string | null;
};

type KioskDeviceRow = {
  id: string;
  name: string;
  device_code: string;
};

export default async function ShopStampPage({ params }: { params: { shopId: string } }) {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, is_active')
    .eq('id', params.shopId)
    .maybeSingle<StoreRow>();

  if (!store || !store.is_active) notFound();

  const [{ data: assignments }, { data: defaultStaff }, { data: kioskDevices }] = await Promise.all([
    supabase
      .from('store_staff_assignments')
      .select('staff_id')
      .eq('store_id', store.id)
      .lte('starts_on', today)
      .or(`ends_on.is.null,ends_on.gte.${today}`),
    supabase
      .from('staff')
      .select('id, name, employee_code')
      .eq('default_store_id', store.id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('kiosk_devices')
      .select('id, name, device_code')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  const assignmentStaffIds = Array.from(new Set((assignments ?? []).map((assignment) => assignment.staff_id)));
  const { data: assignedStaff } = assignmentStaffIds.length > 0
    ? await supabase
        .from('staff')
        .select('id, name, employee_code')
        .in('id', assignmentStaffIds)
        .eq('is_active', true)
        .order('name', { ascending: true })
    : { data: [] };

  const staffById = new Map<string, StaffRow>();
  [...((assignedStaff ?? []) as StaffRow[]), ...((defaultStaff ?? []) as StaffRow[])].forEach((staff) => {
    staffById.set(staff.id, staff);
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">店舗iPad打刻</h1>
            <p className="mt-1 text-sm text-gray-600">スタッフを選択し、PINを入力して打刻します。</p>
          </div>
          <Link href="/stamp">
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <KioskStampPanel
          storeId={store.id}
          storeName={store.name}
          staff={Array.from(staffById.values())}
          kioskDevices={(kioskDevices ?? []) as KioskDeviceRow[]}
        />
      </div>
    </main>
  );
}
