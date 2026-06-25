'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'

export default function StampPage() {
  const [selectedShop, setSelectedShop] = useState<string>('')

  const shops = [
    { id: 'shop1', name: '渋谷店' },
    { id: 'shop2', name: '新宿店' },
    { id: 'shop3', name: '池袋店' },
  ]

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>打刻システム</CardTitle>
          <CardDescription>店舗を選択して進みます</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">店舗を選択</label>
            <Select value={selectedShop} onValueChange={setSelectedShop}>
              <SelectTrigger>
                <SelectValue placeholder="店舗を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((shop) => (
                  <SelectItem key={shop.id} value={shop.id}>
                    {shop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedShop && (
            <Link
              href={`/stamp/${selectedShop}`}
              className="block"
            >
              <Button className="w-full" size="lg">
                次へ
              </Button>
            </Link>
          )}

          <Link href="/" className="block">
            <Button variant="outline" className="w-full">
              戻る
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
