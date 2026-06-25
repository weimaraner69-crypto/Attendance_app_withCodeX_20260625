'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AttendanceStatus {
  status: 'on_duty' | 'off_duty' | 'break'
  startTime?: string
  endTime?: string
  breakTime?: string
}

interface AttendanceStatusCardProps {
  status: AttendanceStatus
  staffName: string
}

export function AttendanceStatusCard({
  status,
  staffName,
}: AttendanceStatusCardProps) {
  const statusLabel = {
    on_duty: '出勤中',
    off_duty: '退勤済み',
    break: '休憩中',
  }[status.status]

  const statusColor = {
    on_duty: 'default',
    off_duty: 'secondary',
    break: 'outline',
  }[status.status] as 'default' | 'secondary' | 'outline'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{staffName}</CardTitle>
        <CardDescription>勤怠状態</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge variant={statusColor}>{statusLabel}</Badge>

        <div className="space-y-2 text-sm">
          {status.startTime && (
            <div className="flex justify-between">
              <span className="text-gray-600">出勤時刻:</span>
              <span className="font-medium">{status.startTime}</span>
            </div>
          )}
          {status.breakTime && (
            <div className="flex justify-between">
              <span className="text-gray-600">休憩時間:</span>
              <span className="font-medium">{status.breakTime}</span>
            </div>
          )}
          {status.endTime && (
            <div className="flex justify-between">
              <span className="text-gray-600">退勤時刻:</span>
              <span className="font-medium">{status.endTime}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
