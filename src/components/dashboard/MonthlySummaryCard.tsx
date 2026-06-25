'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface MonthlySummary {
  totalWorkDays: number
  totalWorkHours: number
  totalBreakHours: number
  averageWorkHours: number
}

interface MonthlySummaryCardProps {
  month: string
  summary: MonthlySummary
}

export function MonthlySummaryCard({ month, summary }: MonthlySummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{month} 勤務サマリー</CardTitle>
        <CardDescription>月間の勤務統計</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-gray-600">勤務日数</p>
            <p className="text-2xl font-bold">{summary.totalWorkDays}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">総勤務時間</p>
            <p className="text-2xl font-bold">{summary.totalWorkHours.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">総休憩時間</p>
            <p className="text-2xl font-bold">{summary.totalBreakHours.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">平均勤務時間</p>
            <p className="text-2xl font-bold">{summary.averageWorkHours.toFixed(1)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
