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

export default function ShopStampPage({ params }: { params: { shopId: string } }) {
  const [selectedStaff, setSelectedStaff] = useState<string>('')

  const staffList = [
    { id: 'staff1', name: '田中太郎' },
    { id: 'staff2', name: '鈴木花子' },
    { id: 'staff3', name: '佐藤次郎' },
  ]

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>スタッフ選択</CardTitle>
          <CardDescription>店舗ID: {params.shopId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">スタッフを選択</label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger>
                <SelectValue placeholder="スタッフを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStaff && (
            <Link
              href={`/stamp/${params.shopId}/${selectedStaff}`}
              className="block"
            >
              <Button className="w-full" size="lg">
                次へ
              </Button>
            </Link>
          )}

          <Link href="/stamp" className="block">
            <Button variant="outline" className="w-full">
              戻る
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
