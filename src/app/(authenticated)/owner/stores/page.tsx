import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

type StoreRow = {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_radius_meters: number;
  is_active: boolean;
  updated_at: string;
};

type KioskDeviceRow = {
  id: string;
  store_id: string;
  device_code: string;
  name: string;
  is_active: boolean;
  last_seen_at: string | null;
};

function nullableText(value: FormDataEntryValue | null) {
  const text = value?.toString().trim() ?? '';
  return text.length > 0 ? text : null;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const text = value?.toString().trim() ?? '';
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function requiredText(value: FormDataEntryValue | null) {
  return value?.toString().trim() ?? '';
}

function radiusValue(value: FormDataEntryValue | null) {
  const number = Number(value?.toString() ?? '300');
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 300;
}

async function createStore(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const name = requiredText(formData.get('name'));

  if (!name) return;

  await supabase.from('stores').insert({
    organization_id: context.profile.organization_id,
    code: nullableText(formData.get('code')),
    name,
    address: nullableText(formData.get('address')),
    latitude: nullableNumber(formData.get('latitude')),
    longitude: nullableNumber(formData.get('longitude')),
    gps_radius_meters: radiusValue(formData.get('gps_radius_meters')),
    is_active: true,
  });

  revalidatePath('/owner/stores');
}

async function updateStore(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const storeId = requiredText(formData.get('store_id'));
  const name = requiredText(formData.get('name'));

  if (!storeId || !name) return;

  await supabase
    .from('stores')
    .update({
      code: nullableText(formData.get('code')),
      name,
      address: nullableText(formData.get('address')),
      latitude: nullableNumber(formData.get('latitude')),
      longitude: nullableNumber(formData.get('longitude')),
      gps_radius_meters: radiusValue(formData.get('gps_radius_meters')),
    })
    .eq('id', storeId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath('/owner/stores');
}

async function setStoreActive(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const storeId = requiredText(formData.get('store_id'));
  const isActive = formData.get('is_active') === 'true';

  if (!storeId) return;

  await supabase
    .from('stores')
    .update({ is_active: isActive })
    .eq('id', storeId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath('/owner/stores');
}

async function createKioskDevice(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const storeId = requiredText(formData.get('store_id'));
  const deviceCode = requiredText(formData.get('device_code'));
  const name = requiredText(formData.get('name'));

  if (!storeId || !deviceCode || !name) return;

  await supabase.from('kiosk_devices').insert({
    organization_id: context.profile.organization_id,
    store_id: storeId,
    device_code: deviceCode,
    name,
    is_active: true,
  });

  revalidatePath('/owner/stores');
}

async function setKioskDeviceActive(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const deviceId = requiredText(formData.get('device_id'));
  const isActive = formData.get('is_active') === 'true';

  if (!deviceId) return;

  await supabase
    .from('kiosk_devices')
    .update({ is_active: isActive })
    .eq('id', deviceId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath('/owner/stores');
}

export default async function StoresPage() {
  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();

  const [{ data: stores }, { data: kioskDevices }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, code, name, address, latitude, longitude, gps_radius_meters, is_active, updated_at')
      .eq('organization_id', context.profile.organization_id)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('kiosk_devices')
      .select('id, store_id, device_code, name, is_active, last_seen_at')
      .eq('organization_id', context.profile.organization_id)
      .order('name', { ascending: true }),
  ]);

  const storeRows = (stores ?? []) as StoreRow[];
  const kioskRows = (kioskDevices ?? []) as KioskDeviceRow[];
  const kiosksByStore = kioskRows.reduce<Record<string, KioskDeviceRow[]>>((acc, device) => {
    acc[device.store_id] = [...(acc[device.store_id] ?? []), device];
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">店舗管理</h2>
          <p className="mt-1 text-sm text-gray-600">店舗情報、GPS判定、店舗iPad端末を管理します。</p>
        </div>
        <Link href="/owner">
          <Button variant="outline">戻る</Button>
        </Link>
      </div>

      <section className="space-y-4 rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold">店舗を追加</h3>
        <form action={createStore} className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="new-store-name">店舗名</Label>
            <Input id="new-store-name" name="name" required placeholder="渋谷店" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-store-code">店舗コード</Label>
            <Input id="new-store-code" name="code" placeholder="SHIBUYA" />
          </div>
          <div className="space-y-1 md:col-span-3">
            <Label htmlFor="new-store-address">住所</Label>
            <Input id="new-store-address" name="address" placeholder="東京都..." />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-store-latitude">緯度</Label>
            <Input id="new-store-latitude" name="latitude" inputMode="decimal" placeholder="35.6812" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-store-longitude">経度</Label>
            <Input id="new-store-longitude" name="longitude" inputMode="decimal" placeholder="139.7671" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-store-radius">GPS半径m</Label>
            <Input id="new-store-radius" name="gps_radius_meters" type="number" min="1" defaultValue="300" />
          </div>
          <div className="flex items-end md:col-span-3">
            <Button type="submit">追加</Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">店舗一覧</h3>
          <span className="text-sm text-gray-500">{storeRows.length}件</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>店舗</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>端末</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {storeRows.map((store) => {
              const devices = kiosksByStore[store.id] ?? [];

              return (
                <TableRow key={store.id}>
                  <TableCell className="min-w-[280px] whitespace-normal align-top">
                    <form action={updateStore} className="grid gap-2">
                      <input type="hidden" name="store_id" value={store.id} />
                      <div className="grid grid-cols-3 gap-2">
                        <Input name="name" defaultValue={store.name} aria-label={`${store.name} 店舗名`} required />
                        <Input name="code" defaultValue={store.code ?? ''} aria-label={`${store.name} 店舗コード`} placeholder="コード" />
                        <Input name="gps_radius_meters" type="number" min="1" defaultValue={store.gps_radius_meters} aria-label={`${store.name} GPS半径`} />
                      </div>
                      <Input name="address" defaultValue={store.address ?? ''} aria-label={`${store.name} 住所`} placeholder="住所" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input name="latitude" defaultValue={store.latitude ?? ''} aria-label={`${store.name} 緯度`} placeholder="緯度" />
                        <Input name="longitude" defaultValue={store.longitude ?? ''} aria-label={`${store.name} 経度`} placeholder="経度" />
                      </div>
                      <div>
                        <Button type="submit" variant="outline" size="sm">保存</Button>
                      </div>
                    </form>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="text-sm">
                      <div>{store.latitude ?? '-'}, {store.longitude ?? '-'}</div>
                      <div className="text-gray-500">{store.gps_radius_meters}m</div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={store.is_active ? 'default' : 'outline'}>
                      {store.is_active ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[300px] whitespace-normal align-top">
                    <div className="space-y-3">
                      {devices.length > 0 ? (
                        <div className="space-y-2">
                          {devices.map((device) => (
                            <div key={device.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                              <div>
                                <div className="font-medium">{device.name}</div>
                                <div className="text-xs text-gray-500">{device.device_code}</div>
                              </div>
                              <form action={setKioskDeviceActive}>
                                <input type="hidden" name="device_id" value={device.id} />
                                <input type="hidden" name="is_active" value={String(!device.is_active)} />
                                <Button type="submit" variant="outline" size="sm">
                                  {device.is_active ? '無効化' : '有効化'}
                                </Button>
                              </form>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">端末未登録</p>
                      )}
                      <form action={createKioskDevice} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input type="hidden" name="store_id" value={store.id} />
                        <Input name="device_code" placeholder="端末コード" required aria-label={`${store.name} 端末コード`} />
                        <Input name="name" placeholder="端末名" required aria-label={`${store.name} 端末名`} />
                        <Button type="submit" variant="outline" size="sm">追加</Button>
                      </form>
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <form action={setStoreActive}>
                      <input type="hidden" name="store_id" value={store.id} />
                      <input type="hidden" name="is_active" value={String(!store.is_active)} />
                      <Button type="submit" variant="outline" size="sm">
                        {store.is_active ? '無効化' : '有効化'}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              );
            })}
            {storeRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                  店舗がまだありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
