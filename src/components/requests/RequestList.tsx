'use client'

import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface RequestItem {
  id: string
  staffName: string
  requestType: 'correction' | 'leave' | 'overtime'
  date: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string
}

interface RequestListProps {
  requests: RequestItem[]
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export function RequestList({ requests, onApprove, onReject }: RequestListProps) {
  const statusLabel = {
    pending: '保留中',
    approved: '承認済み',
    rejected: '却下',
  }

  const statusColor = {
    pending: 'outline',
    approved: 'default',
    rejected: 'destructive',
  } as const

  const requestTypeLabel = {
    correction: '打刻修正',
    leave: '休暇申請',
    overtime: '残業申請',
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>スタッフ名</TableHead>
            <TableHead>申請種類</TableHead>
            <TableHead>日付</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>理由</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">{request.staffName}</TableCell>
              <TableCell>{requestTypeLabel[request.requestType]}</TableCell>
              <TableCell>{request.date}</TableCell>
              <TableCell>
                <Badge variant={statusColor[request.status]}>
                  {statusLabel[request.status]}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm">
                {request.reason}
              </TableCell>
              <TableCell className="text-right space-x-2">
                {request.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onApprove?.(request.id)}
                    >
                      承認
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onReject?.(request.id)}
                    >
                      却下
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
