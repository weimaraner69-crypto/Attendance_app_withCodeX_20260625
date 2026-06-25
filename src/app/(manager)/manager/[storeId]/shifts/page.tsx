import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ManagerShiftsPage({
  params,
}: {
  params: { storeId: string };
}) {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">シフト管理</h1>
          <Link href={`/manager/${params.storeId}`}>
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>シフト一覧</CardTitle>
            <CardDescription>B-004で実データに接続します。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">現在表示できるシフトはありません。</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
