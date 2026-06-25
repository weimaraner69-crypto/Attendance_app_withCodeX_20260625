'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">スタッフ管理</h2>
        <Link href="/owner">
          <Button variant="outline">戻る</Button>
        </Link>
      </div>
      <p className="text-gray-600">スタッフ一覧表示</p>
    </div>
  )
}
