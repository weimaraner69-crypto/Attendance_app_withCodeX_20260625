'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<string>('')

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>管理者・社労士ログイン</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>ロール</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">オーナー</SelectItem>
                <SelectItem value="sr">社労士</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input type="email" placeholder="メールアドレス" />
          <Input type="password" placeholder="パスワード" />
          <Button className="w-full">ログイン</Button>
          <Link href="/" className="block">
            <Button variant="ghost" className="w-full">戻る</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
