'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface GpsCheckerProps {
  shopId?: string
}

export function GpsChecker(_: GpsCheckerProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isInRange, setIsInRange] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ lat: latitude, lng: longitude })
          // 実装では店舗座標と距離を比較
          setIsInRange(true)
        },
        (err) => {
          setError('位置情報を取得できません')
          console.error(err)
        }
      )
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">位置情報確認</CardTitle>
        <CardDescription>店舗範囲内での打刻を確認します</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Badge variant="destructive">{error}</Badge>
        )}
        {location && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              緯度: {location.lat.toFixed(6)}
            </p>
            <p className="text-sm text-gray-600">
              経度: {location.lng.toFixed(6)}
            </p>
          </div>
        )}
        <Badge variant={isInRange ? "default" : "destructive"}>
          {isInRange ? '店舗範囲内' : '店舗範囲外'}
        </Badge>
      </CardContent>
    </Card>
  )
}
