import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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

type ManagerProfileRow = {
  id: string;
  display_name: string;
  email: string;
  is_active: boolean;
};

type StoreRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type ManagerPermissionRow = {
  id: string;
  user_id: string;
  store_id: string;
  stores: {
    id: string;
    name: string;
    is_active: boolean;
  } | null;
};

function requiredText(value: FormDataEntryValue | null) {
  return value?.toString().trim() ?? '';
}

async function assignManagerStore(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const userId = requiredText(formData.get('user_id'));
  const storeId = requiredText(formData.get('store_id'));

  if (!userId || !storeId) return;

  await supabase
    .from('manager_store_permissions')
    .upsert(
      {
        organization_id: context.profile.organization_id,
        user_id: userId,
        store_id: storeId,
      },
      { onConflict: 'user_id,store_id' }
    );

  revalidatePath('/owner/sr-accounts');
}

async function removeManagerStore(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const permissionId = requiredText(formData.get('permission_id'));

  if (!permissionId) return;

  await supabase
    .from('manager_store_permissions')
    .delete()
    .eq('id', permissionId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath('/owner/sr-accounts');
}

export default async function SRAccountsPage() {
  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();

  const [{ data: managers }, { data: stores }, { data: permissions }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, display_name, email, is_active')
      .eq('organization_id', context.profile.organization_id)
      .eq('role', 'manager')
      .order('is_active', { ascending: false })
      .order('display_name', { ascending: true }),
    supabase
      .from('stores')
      .select('id, name, is_active')
      .eq('organization_id', context.profile.organization_id)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('manager_store_permissions')
      .select('id, user_id, store_id, stores:store_id (id, name, is_active)')
      .eq('organization_id', context.profile.organization_id)
      .order('created_at', { ascending: true }),
  ]);

  const managerRows = (managers ?? []) as ManagerProfileRow[];
  const storeRows = (stores ?? []) as StoreRow[];
  const permissionRows = (permissions ?? []) as ManagerPermissionRow[];
  const permissionsByManager = permissionRows.reduce<Record<string, ManagerPermissionRow[]>>(
    (acc, permission) => {
      acc[permission.user_id] = [...(acc[permission.user_id] ?? []), permission];
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">権限管理</h2>
          <p className="mt-1 text-sm text-gray-600">店長が操作できる担当店舗を管理します。</p>
        </div>
        <Link href="/owner" className={buttonVariants({ variant: 'outline' })}>
          戻る
        </Link>
      </div>

      <section className="space-y-4 rounded-lg border bg-white p-4">
        <div>
          <h3 className="text-lg font-semibold">店長の担当店舗設定</h3>
          <p className="mt-1 text-sm text-gray-600">
            店長ユーザーは `user_profiles.role = manager` のユーザーが表示されます。
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>店長</TableHead>
              <TableHead>担当店舗</TableHead>
              <TableHead>店舗を追加</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managerRows.map((manager) => {
              const managerPermissions = permissionsByManager[manager.id] ?? [];
              const assignedStoreIds = new Set(managerPermissions.map((permission) => permission.store_id));
              const assignableStores = storeRows.filter((store) => !assignedStoreIds.has(store.id));

              return (
                <TableRow key={manager.id}>
                  <TableCell className="min-w-[240px] whitespace-normal align-top">
                    <div className="font-medium">{manager.display_name}</div>
                    <div className="text-sm text-gray-500">{manager.email}</div>
                    <div className="mt-2">
                      <Badge variant={manager.is_active ? 'default' : 'outline'}>
                        {manager.is_active ? '有効' : '無効'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[300px] whitespace-normal align-top">
                    {managerPermissions.length > 0 ? (
                      <div className="space-y-2">
                        {managerPermissions.map((permission) => (
                          <div
                            key={permission.id}
                            className="flex items-center justify-between gap-2 rounded-md border p-2"
                          >
                            <div>
                              <div className="font-medium">{permission.stores?.name ?? '不明な店舗'}</div>
                              <div className="text-xs text-gray-500">
                                {permission.stores?.is_active === false ? '店舗無効' : '店舗有効'}
                              </div>
                            </div>
                            <form action={removeManagerStore}>
                              <input type="hidden" name="permission_id" value={permission.id} />
                              <Button type="submit" variant="outline" size="sm">解除</Button>
                            </form>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">担当店舗未設定</p>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[260px] whitespace-normal align-top">
                    <form action={assignManagerStore} className="flex gap-2">
                      <input type="hidden" name="user_id" value={manager.id} />
                      <select
                        name="store_id"
                        required
                        className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        defaultValue=""
                      >
                        <option value="" disabled>店舗を選択</option>
                        {assignableStores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}{store.is_active ? '' : '（無効）'}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm" disabled={assignableStores.length === 0}>
                        追加
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              );
            })}
            {managerRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-gray-500">
                  店長ユーザーがまだありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
