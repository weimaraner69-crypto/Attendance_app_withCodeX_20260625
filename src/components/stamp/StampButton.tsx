'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Toaster, toast } from 'sonner'

interface StampButtonProps {
  staffId: string
  shopId: string
  onStampSuccess?: () => void
}

export function StampButton({ staffId, shopId, onStampSuccess }: StampButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleStamp = async () => {
    try {
      setIsLoading(true)
      // APIコール処理
      console.log('打刻:', { staffId, shopId })
      toast.success('打刻完了しました')
      onStampSuccess?.()
    } catch (error) {
      toast.error('打刻に失敗しました')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button onClick={handleStamp} disabled={isLoading} size="lg">
        {isLoading ? '処理中...' : '打刻する'}
      </Button>
      <Toaster />
    </>
  )
}
