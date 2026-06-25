'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface ShiftInfo {
  id: string
  staffName: string
  date: string
  startTime: string
  endTime: string
  duration: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
}

interface ShiftScheduleCardProps {
  shift: ShiftInfo
}

export function ShiftScheduleCard({
  shift,
}: ShiftScheduleCardProps) {
  const statusLabel = {
    scheduled: '予定中',
    confirmed: '確認済み',
    completed: '完了',
    cancelled: 'キャンセル',
  }

  const statusColor = {
    scheduled: 'outline',
    confirmed: 'default',
    completed: 'secondary',
    cancelled: 'destructive',
  } as const

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{shift.staffName}</CardTitle>
            <CardDescription>{shift.date}</CardDescription>
          </div>
          <Badge variant={statusColor[shift.status]}>
            {statusLabel[shift.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">開始時刻:</span>
            <span className="font-medium">{shift.startTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">終了時刻:</span>
            <span className="font-medium">{shift.endTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">勤務時間:</span>
            <span className="font-medium">{shift.duration}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
