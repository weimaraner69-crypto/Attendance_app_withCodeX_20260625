'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export default function OwnerPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">オーナーダッシュボード</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/owner/stores">
          <Card className="hover:shadow-lg cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">店舗管理</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/owner/staff">
          <Card className="hover:shadow-lg cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">スタッフ管理</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/owner/reports">
          <Card className="hover:shadow-lg cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">レポート</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/owner/sr-accounts">
          <Card className="hover:shadow-lg cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">権限管理</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/owner/audit-logs">
          <Card className="hover:shadow-lg cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">監査ログ</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/owner/integrations/api-keys">
          <Card className="hover:shadow-lg cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">外部連携APIキー</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
