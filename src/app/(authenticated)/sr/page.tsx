'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SRPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">社労士ダッシュボード</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/sr/reports">
          <Card className="hover:shadow-lg cursor-pointer">
            <CardHeader>
              <CardTitle>レポート</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>統計情報</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">対象店舗・スタッフ情報</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
