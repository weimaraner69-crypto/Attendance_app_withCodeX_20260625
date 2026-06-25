'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AttendanceStatusCard } from '@/components/dashboard/AttendanceStatusCard'
import { MonthlySummaryCard } from '@/components/dashboard/MonthlySummaryCard'

export default function ManagerDashboardPage({
  params,
}: {
  params: { storeId: string }
}) {
  const staffAttendances = [
    {
      status: 'on_duty' as const,
      startTime: '09:00',
      staffName: '田中太郎',
    },
    {
      status: 'off_duty' as const,
      startTime: '09:15',
      endTime: '18:00',
      staffName: '鈴木花子',
    },
    {
      status: 'break' as const,
      startTime: '09:30',
      breakTime: '12:00-13:00',
      staffName: '佐藤次郎',
    },
  ]

  const monthlySummary = {
    totalWorkDays: 20,
    totalWorkHours: 160,
    totalBreakHours: 20,
    averageWorkHours: 8,
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">店長ダッシュボード</h1>
          <Link href="/manager/login">
            <Button variant="outline">ログアウト</Button>
          </Link>
        </div>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="attendance">勤務状態</TabsTrigger>
            <TabsTrigger value="requests">申請管理</TabsTrigger>
            <TabsTrigger value="shifts">シフト管理</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {staffAttendances.map((attendance, idx) => (
                <AttendanceStatusCard
                  key={idx}
                  status={attendance}
                  staffName={attendance.staffName}
                />
              ))}
            </div>

            <MonthlySummaryCard
              month="4月"
              summary={monthlySummary}
            />
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <Link href={`/manager/${params.storeId}/requests`}>
              <Button className="w-full">申請一覧を見る</Button>
            </Link>
          </TabsContent>

          <TabsContent value="shifts" className="mt-6">
            <Link href={`/manager/${params.storeId}/shifts`}>
              <Button className="w-full">シフト管理へ</Button>
            </Link>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
