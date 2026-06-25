'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SRAccountsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">社労士管理</h2>
        <Link href="/owner">
          <Button variant="outline">戻る</Button>
        </Link>
      </div>
      <p className="text-gray-600">社労士アカウント管理</p>
    </div>
  )
}
