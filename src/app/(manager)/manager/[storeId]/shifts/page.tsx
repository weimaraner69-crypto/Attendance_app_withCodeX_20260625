'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShiftScheduleCard } from '@/components/shifts/ShiftScheduleCard'

export default function ManagerShiftsPage({
  params,
}: {
  params: { storeId: string }
}) {
  const shifts = [
    {
      id: 'shift1',
      staffName: '田中太郎',
      date: '2026-04-17',
      startTime: '09:00',
      endTime: '18:00',
      duration: '9時間',
      status: 'scheduled' as const,
    },
    {
      id: 'shift2',
      staffName: '鈴木花子',
      date: '2026-04-17',
      startTime: '10:00',
      endTime: '19:00',
      duration: '9時間',
      status: 'confirmed' as const,
    },
    {
      id: 'shift3',
      staffName: '佐藤次郎',
      date: '2026-04-17',
      startTime: '12:00',
      endTime: '21:00',
      duration: '9時間',
      status: 'completed' as const,
    },
  ]

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">シフト管理</h1>
          <Link href={`/manager/${params.storeId}`}>
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shifts.map((shift) => (
            <ShiftScheduleCard key={shift.id} shift={shift} />
          ))}
        </div>
      </div>
    </main>
  )
}
