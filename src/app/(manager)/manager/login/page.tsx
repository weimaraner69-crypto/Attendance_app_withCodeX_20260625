'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const loginSchema = z.object({
  storeId: z.string().min(1, '店舗を選択してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上必要です'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function ManagerLoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStore, setSelectedStore] = useState<string>('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      console.log('店長ログイン:', data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const stores = [
    { id: 'store1', name: '渋谷店' },
    { id: 'store2', name: '新宿店' },
    { id: 'store3', name: '池袋店' },
  ]

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>店長ログイン</CardTitle>
          <CardDescription>店長用管理画面にログインします</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeId">店舗</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="店舗を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.storeId && (
                <p className="text-sm text-red-500">{errors.storeId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="パスワードを入力"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full">
                トップページに戻る
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
