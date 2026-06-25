'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RequestList } from '@/components/requests/RequestList'

export default function ManagerRequestsPage({
  params,
}: {
  params: { storeId: string }
}) {
  const requests = [
    {
      id: '1',
      staffName: '田中太郎',
      requestType: 'correction' as const,
      date: '2026-04-15',
      status: 'pending' as const,
      reason: '朝の打刻ミス',
    },
    {
      id: '2',
      staffName: '鈴木花子',
      requestType: 'leave' as const,
      date: '2026-04-20',
      status: 'pending' as const,
      reason: '医師の診察',
    },
    {
      id: '3',
      staffName: '佐藤次郎',
      requestType: 'overtime' as const,
      date: '2026-04-17',
      status: 'approved' as const,
      reason: 'プロジェクト納期対応',
    },
  ]

  const handleApprove = (id: string) => {
    console.log('承認:', id)
  }

  const handleReject = (id: string) => {
    console.log('却下:', id)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">申請管理</h1>
          <Link href={`/manager/${params.storeId}`}>
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <RequestList
          requests={requests}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
    </main>
  )
}
