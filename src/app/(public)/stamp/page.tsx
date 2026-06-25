import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseAdminClient } from '@/lib/supabase';

type StoreRow = {
  id: string;
  name: string;
  code: string | null;
};

export const dynamic = 'force-dynamic';

export default async function StampPage() {
  const supabase = createSupabaseAdminClient();
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const storeRows = (stores ?? []) as StoreRow[];

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">打刻</h1>
            <p className="mt-1 text-sm text-gray-600">店舗iPad打刻または個人スマホ打刻を選択します。</p>
          </div>
          <Link href="/">
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>店舗iPad打刻</CardTitle>
            <CardDescription>店舗を固定し、スタッフ選択とPIN入力で打刻します。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {storeRows.map((store) => (
              <Link key={store.id} href={`/stamp/${store.id}`} className="block">
                <Button variant="outline" className="h-auto w-full justify-start py-4">
                  <span className="text-left">
                    <span className="block font-medium">{store.name}</span>
                    {store.code && <span className="block text-xs text-gray-500">{store.code}</span>}
                  </span>
                </Button>
              </Link>
            ))}
            {storeRows.length === 0 && (
              <p className="text-sm text-gray-500">有効な店舗がありません。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>個人スマホ打刻</CardTitle>
            <CardDescription>ログイン済みスタッフとして店舗を選択し、GPS付きで打刻します。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/stamp/mobile">
              <Button className="w-full" size="lg">個人スマホ打刻へ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
