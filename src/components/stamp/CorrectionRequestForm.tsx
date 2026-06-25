'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const correctionSchema = z.object({
  correctionType: z.enum(['start_time', 'end_time', 'both']),
  correctionStartTime: z.string().optional(),
  correctionEndTime: z.string().optional(),
  reason: z.string().min(1, '理由を入力してください'),
})

type CorrectionFormData = z.infer<typeof correctionSchema>

interface CorrectionRequestFormProps {
  staffId: string
  shopId: string
  onSubmit?: (data: CorrectionFormData) => void
}

export function CorrectionRequestForm({
  staffId,
  shopId,
  onSubmit,
}: CorrectionRequestFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CorrectionFormData>({
    resolver: zodResolver(correctionSchema),
  })

  const correctionType = watch('correctionType')

  const onFormSubmit = async (data: CorrectionFormData) => {
    try {
      setIsLoading(true)
      console.log('修正申請:', { ...data, staffId, shopId })
      onSubmit?.(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">打刻修正申請</CardTitle>
        <CardDescription>打刻時間の修正をリクエストします</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correctionType">修正対象</Label>
            <Select defaultValue="start_time">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start_time">出勤時刻</SelectItem>
                <SelectItem value="end_time">退勤時刻</SelectItem>
                <SelectItem value="both">両方</SelectItem>
              </SelectContent>
            </Select>
            {errors.correctionType && (
              <p className="text-sm text-red-500">{errors.correctionType.message}</p>
            )}
          </div>

          {(correctionType === 'start_time' || correctionType === 'both') && (
            <div className="space-y-2">
              <Label htmlFor="correctionStartTime">出勤時刻</Label>
              <Input
                id="correctionStartTime"
                type="time"
                {...register('correctionStartTime')}
              />
            </div>
          )}

          {(correctionType === 'end_time' || correctionType === 'both') && (
            <div className="space-y-2">
              <Label htmlFor="correctionEndTime">退勤時刻</Label>
              <Input
                id="correctionEndTime"
                type="time"
                {...register('correctionEndTime')}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">理由</Label>
            <Input
              id="reason"
              placeholder="修正理由を入力してください"
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? '処理中...' : '申請する'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
